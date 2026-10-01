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
const AI_MODEL = "google/gemini-3.8-flash";

interface Suggestion {
  title: string;
  year: number | null;
  why: string;
}

interface ParsedQuery {
  searchText: string;
  genres: string[];
  yearMin: number | null;
  yearMax: number | null;
  minRating: number | null;
  referenceTitle: string | null;
  mood: string | null;
  language: string | null;
  titles: Suggestion[];
}

/**
 * One LLM call that both understands the request AND names concrete titles.
 * Naming real titles is what makes the answers exact — vector search alone
 * drifts on a sparse index.
 */
async function parseNlQuery(q: string): Promise<ParsedQuery> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const year = new Date().getFullYear();
  const system = `You are a precise film expert. The user describes what they want to watch. Answer with ONLY a JSON object:
{
  "searchText": string,            // concise restatement of the intent
  "genres": string[],              // subset of exactly: ${ALL_GENRES.join(", ")} (empty if unclear)
  "yearMin": number|null, "yearMax": number|null,   // 4-digit years (today is ${year})
  "minRating": number|null,        // 0-10, only if they demanded quality
  "referenceTitle": string|null,   // a movie they compared to
  "mood": string|null,             // short mood label
  "language": string|null,         // ISO-639-1 code if they named a language/industry (te, ta, kn, ml, hi, ja, ko, zh, es, fr...)
  "titles": [{"title": string, "year": number|null, "why": string}]  // 18-24 REAL existing films/series that genuinely satisfy the request
}
Rules for "titles": they must actually exist and must match every explicit constraint (genre, era, language, rating, similarity to the reference). Order best match first. "why" is one short specific clause explaining the fit (max 12 words). Never invent titles. JSON only, no prose.`;
  const res = await fetch(`${AI_GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: AI_MODEL,
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
  try { parsed = JSON.parse(raw) as Partial<ParsedQuery>; } catch { /* fall through */ }
  const titles: Suggestion[] = Array.isArray(parsed.titles)
    ? parsed.titles
        .filter((t): t is Suggestion => Boolean(t) && typeof (t as Suggestion).title === "string")
        .slice(0, 24)
        .map((t) => ({
          title: t.title.trim(),
          year: typeof t.year === "number" && t.year > 1880 ? t.year : null,
          why: typeof t.why === "string" ? t.why.trim() : "",
        }))
    : [];
  return {
    searchText: (parsed.searchText || q).slice(0, 1000),
    genres: Array.isArray(parsed.genres) ? parsed.genres.filter((g): g is string => typeof g === "string" && ALL_GENRES.includes(g)) : [],
    yearMin: typeof parsed.yearMin === "number" ? parsed.yearMin : null,
    yearMax: typeof parsed.yearMax === "number" ? parsed.yearMax : null,
    minRating: typeof parsed.minRating === "number" ? parsed.minRating : null,
    referenceTitle: typeof parsed.referenceTitle === "string" && parsed.referenceTitle.length > 0 ? parsed.referenceTitle : null,
    mood: typeof parsed.mood === "string" && parsed.mood.length > 0 ? parsed.mood : null,
    language: typeof parsed.language === "string" && /^[a-z]{2}$/.test(parsed.language) ? parsed.language : null,
    titles,
  };
}

export interface AskResult {
  parsed: ParsedQuery;
  matches: SemanticMatch[];
  summary: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Resolve an LLM-named title to the real TMDB entry (movie first, then TV). */
async function resolveTitle(s: Suggestion): Promise<Movie | null> {
  const pick = (results: TmdbListItem[] | undefined): TmdbListItem | null => {
    const list = results ?? [];
    if (list.length === 0) return null;
    const want = norm(s.title);
    const scored = list.map((r) => {
      const name = norm(r.title || r.name || "");
      const yr = Number((r.release_date || (r as { first_air_date?: string }).first_air_date || "").slice(0, 4)) || 0;
      let score = 0;
      if (name === want) score += 100;
      else if (name.startsWith(want) || want.startsWith(name)) score += 60;
      else if (name.includes(want)) score += 30;
      if (s.year && yr) score += Math.max(0, 20 - Math.abs(yr - s.year) * 6);
      score += Math.min(10, (r.popularity ?? 0) / 20);
      return { r, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0].score >= 25 ? scored[0].r : null;
  };
  try {
    const movie = await tmdbFetch<{ results: TmdbListItem[] }>("/search/movie", {
      query: s.title, include_adult: "false", year: s.year ?? undefined,
    });
    const hit = pick(movie.results);
    if (hit) return normalizeListItem(hit);
  } catch { /* try tv */ }
  try {
    const tv = await tmdbFetch<{ results: TmdbListItem[] }>("/search/tv", { query: s.title, include_adult: "false" });
    const hit = pick(tv.results);
    if (hit) {
      const m = normalizeListItem(hit);
      return { ...m, id: `tv-${m.id}` };
    }
  } catch { /* give up */ }
  return null;
}

/** Discover-based top-up so a thin LLM answer still fills the grid. */
async function discoverFallback(parsed: ParsedQuery, limit: number): Promise<Movie[]> {
  try {
    // OR the genres — ANDing them ("sci-fi AND mystery") returns almost nothing.
    const genreIds = parsed.genres.map((g) => GENRE_NAME_TO_ID[g]).filter(Boolean).join("|");
    const res = await tmdbFetch<{ results: TmdbListItem[] }>("/discover/movie", {
      with_genres: genreIds || undefined,
      with_original_language: parsed.language ?? undefined,
      "primary_release_date.gte": parsed.yearMin ? `${parsed.yearMin}-01-01` : undefined,
      "primary_release_date.lte": parsed.yearMax ? `${parsed.yearMax}-12-31` : undefined,
      "vote_average.gte": parsed.minRating ?? undefined,
      "vote_count.gte": parsed.minRating ? 500 : 200,
      sort_by: parsed.minRating ? "vote_average.desc" : "popularity.desc",
      include_adult: "false",
    });
    return normalizeList(res.results).slice(0, limit);
  } catch {
    return [];
  }
}

function normalizeList(items: TmdbListItem[] | undefined): Movie[] {
  return (items ?? []).map(normalizeListItem);
}

export const askAi = createServerFn({ method: "POST" })
  .inputValidator((d: { q: string }) => z.object({ q: z.string().min(2).max(500) }).parse(d))
  .handler(async ({ data }): Promise<AskResult> => {
    const parsed = await parseNlQuery(data.q);

    // 1. Resolve the LLM's named titles against TMDB — these are the exact answers.
    const resolved = await Promise.all(parsed.titles.map(async (s) => {
      const movie = await resolveTitle(s);
      return movie ? { movie, why: s.why } : null;
    }));

    const seen = new Set<string>();
    const refNorm = parsed.referenceTitle ? norm(parsed.referenceTitle) : null;
    const matches: SemanticMatch[] = [];

    for (const r of resolved) {
      if (!r) continue;
      const { movie, why } = r;
      if (seen.has(movie.id)) continue;
      if (refNorm && norm(movie.title) === refNorm) continue;
      // Hard constraints the user stated explicitly.
      if (parsed.yearMin && movie.year && movie.year < parsed.yearMin) continue;
      if (parsed.yearMax && movie.year && movie.year > parsed.yearMax) continue;
      if (parsed.minRating && movie.rating && movie.rating < parsed.minRating) continue;
      if (parsed.genres.length > 0 && movie.genres.length > 0
        && !parsed.genres.some((g) => (movie.genres as string[]).includes(g))) continue;
      seen.add(movie.id);
      const bits: string[] = [];
      if (why) bits.push(why);
      else if (parsed.referenceTitle) bits.push(`Shares the feel of ${parsed.referenceTitle}`);
      else if (parsed.mood) bits.push(parsed.mood);
      if (movie.rating) bits.push(`${movie.rating.toFixed(1)}/10`);
      matches.push({ movie, similarity: 1 - matches.length / 40, reason: bits.join(" · ") });
    }

    // 2. Top up from TMDB discover when the model named too few usable titles.
    if (matches.length < 12) {
      const extra = await discoverFallback(parsed, 24);
      for (const movie of extra) {
        if (matches.length >= 18 || seen.has(movie.id)) continue;
        seen.add(movie.id);
        matches.push({
          movie,
          similarity: 0.4,
          reason: [parsed.genres[0], `${movie.rating.toFixed(1)}/10 on TMDB`].filter(Boolean).join(" · "),
        });
      }
    }

    const bits: string[] = [];
    if (parsed.referenceTitle) bits.push(`in the spirit of ${parsed.referenceTitle}`);
    if (parsed.mood) bits.push(parsed.mood);
    if (parsed.genres.length) bits.push(parsed.genres.slice(0, 2).join(" & "));
    if (parsed.yearMin || parsed.yearMax) bits.push(`${parsed.yearMin ?? "…"}–${parsed.yearMax ?? "…"}`);
    if (parsed.minRating) bits.push(`≥ ${parsed.minRating}/10`);
    const summary = bits.length
      ? `${matches.length} picks — ${bits.join(", ")}.`
      : `${matches.length} picks matched your request.`;

    return { parsed, matches: matches.slice(0, 18), summary };
  });
