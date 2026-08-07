import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Movie } from "@/data/movies";
import type { Genre } from "@/data/genres";
import { GENRE_NAME_TO_ID } from "@/lib/tmdb.functions";

// ============================================================================
// Semantic search + NL search (Phase 3 + 4)
// - Embeddings via Lovable AI Gateway (openai/text-embedding-3-small, 1536-dim)
// - Vector storage via Lovable Cloud (Postgres + pgvector)
// - NL parsing via google/gemini-3.5-flash (structured JSON)
// ============================================================================

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1";

const GENRE_BY_ID: Record<number, Genre> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 18: "Drama", 10751: "Family", 14: "Fantasy",
  36: "History", 27: "Horror", 9648: "Mystery", 10749: "Romance",
  878: "Science Fiction", 53: "Thriller", 10752: "War", 37: "Western",
};

interface TmdbListItem {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  popularity?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
}

interface TmdbDetails extends TmdbListItem {
  runtime?: number;
  credits?: { cast?: { name: string }[]; crew?: { name: string; job: string }[] };
  keywords?: { keywords?: { name: string }[] };
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const key = process.env["TMDB_API_KEY"]?.trim();
  const accessToken = process.env["TMDB_ACCESS_TOKEN"]?.trim();
  if (!key && !accessToken) throw new Error("TMDB credentials not configured");
  const url = new URL(`${TMDB_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) url.searchParams.set(k, String(v));
  }
  if (key) url.searchParams.set("api_key", key);
  const headers = new Headers({ Accept: "application/json" });
  if (accessToken && !key) headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch(url.toString(), {
    headers,
    cf: { cacheTtl: 3600, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) throw new Error(`TMDB ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

function normalizeListItem(it: TmdbListItem): Movie {
  const year = Number((it.release_date || "").slice(0, 4)) || 0;
  const genres = (it.genre_ids ?? []).map((g) => GENRE_BY_ID[g]).filter((g): g is Genre => Boolean(g));
  return {
    id: String(it.id),
    title: it.title || it.name || "Untitled",
    year,
    genres,
    rating: Math.round((it.vote_average ?? 0) * 10) / 10,
    runtime: 0,
    overview: it.overview || "",
    director: "",
    cast: [],
    keywords: [],
    popularity: Math.min(100, Math.round(it.popularity ?? 0)),
    posterHue: (it.id * 37) % 360,
    posterUrl: it.poster_path ? `${IMG}/w500${it.poster_path}` : null,
    backdropUrl: it.backdrop_path ? `${IMG}/original${it.backdrop_path}` : null,
    trailerYoutubeId: null,
  };
}

async function detailsForEmbedding(id: string): Promise<{ movie: Movie; embedText: string } | null> {
  try {
    const it = await tmdbFetch<TmdbDetails>(`/movie/${id}`, {
      append_to_response: "credits,keywords",
    });
    const year = Number((it.release_date || "").slice(0, 4)) || 0;
    const genres = (it.genres ?? []).map((g) => g.name as Genre).filter((g): g is Genre => Boolean(g));
    const director = it.credits?.crew?.find((c) => c.job === "Director")?.name || "";
    const cast = (it.credits?.cast ?? []).slice(0, 6).map((c) => c.name);
    const keywords = (it.keywords?.keywords ?? []).slice(0, 12).map((k) => k.name);
    const movie: Movie = {
      id: String(it.id),
      title: it.title || it.name || "Untitled",
      year,
      genres,
      rating: Math.round((it.vote_average ?? 0) * 10) / 10,
      runtime: it.runtime ?? 0,
      overview: it.overview || "",
      director,
      cast,
      keywords,
      popularity: Math.min(100, Math.round(it.popularity ?? 0)),
      posterHue: (it.id * 37) % 360,
      posterUrl: it.poster_path ? `${IMG}/w500${it.poster_path}` : null,
      backdropUrl: it.backdrop_path ? `${IMG}/original${it.backdrop_path}` : null,
      trailerYoutubeId: null,
    };
    const blob = [
      `${movie.title} (${movie.year}).`,
      movie.overview,
      genres.length ? `Genres: ${genres.join(", ")}.` : "",
      keywords.length ? `Themes: ${keywords.join(", ")}.` : "",
      director ? `Directed by ${director}.` : "",
      cast.length ? `Starring ${cast.join(", ")}.` : "",
    ].filter(Boolean).join(" ");
    return { movie, embedText: blob };
  } catch {
    return null;
  }
}

async function hashText(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function embedText(text: string): Promise<number[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(`${AI_GATEWAY}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

/** Ensure a movie's embedding exists in Postgres; returns true if newly created. */
async function ensureEmbedding(tmdbId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("movie_embeddings" as never)
    .select("tmdb_id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  if (existing) return false;
  const details = await detailsForEmbedding(tmdbId);
  if (!details) return false;
  const text_hash = await hashText(details.embedText);
  const embedding = await embedText(details.embedText);
  await supabaseAdmin.from("movie_embeddings" as never).upsert({
    tmdb_id: tmdbId,
    embedding: embedding as unknown as string, // pgvector accepts number[] via JSON
    text_hash,
    title: details.movie.title,
    updated_at: new Date().toISOString(),
  } as never);
  return true;
}

async function knn(queryEmbedding: number[], limit: number, excludeId?: string): Promise<{ tmdb_id: string; title: string; similarity: number }[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("match_movie_embeddings" as never, {
    query_embedding: queryEmbedding as unknown as string,
    match_count: limit,
    exclude_id: excludeId ?? null,
  } as never);
  if (error) throw error;
  return (data as { tmdb_id: string; title: string; similarity: number }[]) ?? [];
}

async function hydrateMovie(id: string): Promise<Movie | null> {
  try {
    const it = await tmdbFetch<TmdbDetails>(`/movie/${id}`);
    return normalizeListItem({ ...it, genre_ids: (it.genres ?? []).map((g) => g.id) });
  } catch {
    return null;
  }
}

// ============================================================================
// Semantic similar (given a movie id, find semantically similar movies)
// ============================================================================

export interface SemanticMatch {
  movie: Movie;
  similarity: number;
  reason: string;
}

export const getSemanticSimilar = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; limit?: number }) =>
    z.object({ id: z.string(), limit: z.number().optional() }).parse(d))
  .handler(async ({ data }): Promise<SemanticMatch[]> => {
    const limit = data.limit ?? 12;
    try {
      await ensureEmbedding(data.id);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("movie_embeddings" as never)
        .select("embedding, title")
        .eq("tmdb_id", data.id)
        .maybeSingle();
      const rowTyped = row as { embedding: number[] | string; title: string } | null;
      if (!rowTyped) return [];
      const emb = typeof rowTyped.embedding === "string" ? JSON.parse(rowTyped.embedding) as number[] : rowTyped.embedding;
      const matches = await knn(emb, limit + 1, data.id);
      const hydrated = await Promise.all(matches.slice(0, limit).map(async (m) => {
        const movie = await hydrateMovie(m.tmdb_id);
        if (!movie) return null;
        return {
          movie,
          similarity: m.similarity,
          reason: `Semantically close to ${rowTyped.title} (${Math.round(m.similarity * 100)}% match)`,
        } as SemanticMatch;
      }));
      return hydrated.filter((x): x is SemanticMatch => Boolean(x));
    } catch (err) {
      console.error("getSemanticSimilar failed", err);
      return [];
    }
  });

// ============================================================================
// Natural-language search: parse → embed → KNN → hydrate → explain
// ============================================================================

const ALL_GENRES = Object.keys(GENRE_NAME_TO_ID);

interface ParsedQuery {
  searchText: string;
  genres: string[];
  yearMin: number | null;
  yearMax: number | null;
  minRating: number | null;
  referenceTitle: string | null;
  mood: string | null;
}

async function parseNlQuery(q: string): Promise<ParsedQuery> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const system = `You extract structured movie search filters from a user's natural-language request.
Return ONLY a JSON object with keys:
- searchText (string, required): a concise semantic description of what they want, expanded with tone/themes/plot cues. This will be embedded for vector search.
- genres (array of strings): zero or more of exactly: ${ALL_GENRES.join(", ")}. Omit if unclear.
- yearMin (number or null), yearMax (number or null): 4-digit years, or null.
- minRating (number 0-10 or null): only set if user demanded quality (e.g. "great", "highly rated").
- referenceTitle (string or null): a specific movie name they compared to (e.g. "like Prisoners").
- mood (string or null): short mood label if implied (e.g. "slow-burn", "feel-good", "mind-bending").
No prose. JSON only.`;
  const res = await fetch(`${AI_GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: q },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NL parse ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: Partial<ParsedQuery> = {};
  try { parsed = JSON.parse(raw); } catch { /* fall through */ }
  return {
    searchText: (parsed.searchText || q).slice(0, 1000),
    genres: Array.isArray(parsed.genres) ? parsed.genres.filter((g): g is string => typeof g === "string" && ALL_GENRES.includes(g)) : [],
    yearMin: typeof parsed.yearMin === "number" ? parsed.yearMin : null,
    yearMax: typeof parsed.yearMax === "number" ? parsed.yearMax : null,
    minRating: typeof parsed.minRating === "number" ? parsed.minRating : null,
    referenceTitle: typeof parsed.referenceTitle === "string" && parsed.referenceTitle.length > 0 ? parsed.referenceTitle : null,
    mood: typeof parsed.mood === "string" && parsed.mood.length > 0 ? parsed.mood : null,
  };
}

export interface AskResult {
  parsed: ParsedQuery;
  matches: SemanticMatch[];
  summary: string;
}

export const askAi = createServerFn({ method: "POST" })
  .inputValidator((d: { q: string }) => z.object({ q: z.string().min(2).max(500) }).parse(d))
  .handler(async ({ data }): Promise<AskResult> => {
    const parsed = await parseNlQuery(data.q);

    // 1. Get a query embedding — either from the referenced movie or from searchText
    let queryEmbedding: number[] | null = null;
    let referenceMovie: Movie | null = null;

    if (parsed.referenceTitle) {
      try {
        const search = await tmdbFetch<{ results: TmdbListItem[] }>("/search/movie", {
          query: parsed.referenceTitle,
          include_adult: "false",
        });
        const first = search.results?.[0];
        if (first) {
          referenceMovie = normalizeListItem(first);
          await ensureEmbedding(referenceMovie.id).catch(() => {});
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: row } = await supabaseAdmin
            .from("movie_embeddings" as never)
            .select("embedding")
            .eq("tmdb_id", referenceMovie.id)
            .maybeSingle();
          const rowTyped = row as { embedding: number[] | string } | null;
          if (rowTyped) {
            queryEmbedding = typeof rowTyped.embedding === "string" ? JSON.parse(rowTyped.embedding) as number[] : rowTyped.embedding;
          }
        }
      } catch { /* fall through to text embed */ }
    }

    if (!queryEmbedding) {
      queryEmbedding = await embedText(parsed.searchText);
    }

    // 2. Warm the index with some candidates so cold-start returns something useful.
    // We embed the top TMDB text-search hits, then KNN.
    try {
      const search = await tmdbFetch<{ results: TmdbListItem[] }>("/search/movie", {
        query: parsed.referenceTitle || parsed.searchText.slice(0, 100),
        include_adult: "false",
      });
      const seedIds = (search.results ?? []).slice(0, 10).map((r) => String(r.id));
      await Promise.all(seedIds.map((id) => ensureEmbedding(id).catch(() => false)));
    } catch { /* non-fatal */ }

    // 3. KNN
    const matches = await knn(queryEmbedding, 24, referenceMovie?.id);

    // 4. Hydrate + apply hard filters
    const hydrated = (await Promise.all(matches.map(async (m) => {
      const movie = await hydrateMovie(m.tmdb_id);
      if (!movie) return null;
      if (parsed.yearMin && movie.year && movie.year < parsed.yearMin) return null;
      if (parsed.yearMax && movie.year && movie.year > parsed.yearMax) return null;
      if (parsed.minRating && movie.rating < parsed.minRating) return null;
      if (parsed.genres.length > 0 && !parsed.genres.some((g) => (movie.genres as string[]).includes(g))) return null;
      return { movie, similarity: m.similarity } as { movie: Movie; similarity: number };
    }))).filter((x): x is { movie: Movie; similarity: number } => Boolean(x));

    const matchesWithReason: SemanticMatch[] = hydrated.slice(0, 18).map((h) => {
      const parts: string[] = [];
      if (referenceMovie) parts.push(`Like ${referenceMovie.title}`);
      if (parsed.mood) parts.push(parsed.mood);
      const sharedGenres = parsed.genres.filter((g) => (h.movie.genres as string[]).includes(g));
      if (sharedGenres.length) parts.push(sharedGenres.slice(0, 2).join(" · "));
      parts.push(`${Math.round(h.similarity * 100)}% semantic match`);
      return { movie: h.movie, similarity: h.similarity, reason: parts.join(" — ") };
    });

    const bits: string[] = [];
    if (referenceMovie) bits.push(`similar in feel to ${referenceMovie.title}`);
    if (parsed.mood) bits.push(parsed.mood);
    if (parsed.genres.length) bits.push(parsed.genres.slice(0, 2).join(" & "));
    if (parsed.yearMin || parsed.yearMax) bits.push(`${parsed.yearMin ?? "…"}–${parsed.yearMax ?? "…"}`);
    if (parsed.minRating) bits.push(`≥ ${parsed.minRating}/10`);
    const summary = bits.length
      ? `Found ${matchesWithReason.length} matches — ${bits.join(", ")}.`
      : `Found ${matchesWithReason.length} semantic matches.`;

    return { parsed, matches: matchesWithReason, summary };
  });
