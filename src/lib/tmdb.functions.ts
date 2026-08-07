import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Movie } from "@/data/movies";
import type { Genre } from "@/data/genres";
import {
  safe, fbTrending, fbPopular, fbTopRated, fbUpcoming, fbNewest,
  fbByGenre, fbByGenres, fbDiscover, fbDetails, fbSimilar,
} from "@/lib/tmdb-fallback";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

const GENRE_BY_ID: Record<number, Genre> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 18: "Drama", 10751: "Family", 14: "Fantasy",
  36: "History", 27: "Horror", 9648: "Mystery", 10749: "Romance",
  878: "Science Fiction", 53: "Thriller", 10752: "War", 37: "Western",
};

export const GENRE_NAME_TO_ID: Record<string, number> = {
  "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35,
  "Crime": 80, "Drama": 18, "Family": 10751, "Fantasy": 14,
  "History": 36, "Horror": 27, "Mystery": 9648, "Romance": 10749,
  "Science Fiction": 878, "Thriller": 53, "War": 10752, "Western": 37,
};

// In-memory TTL cache (per warm worker instance). Reduces TMDB calls and
// smooths bursty traffic (search typing, repeated route visits).
interface CacheEntry { expires: number; data: unknown }
const CACHE = new Map<string, CacheEntry>();
const MAX_ENTRIES = 500;

// TTLs (ms) tuned per endpoint volatility. Kept short for "live" catalogue
// endpoints so newly released titles surface quickly; long for static details.
const TTL_DEFAULT = 5 * 60_000;
const TTL_BY_PREFIX: Array<[string, number]> = [
  ["/trending", 10 * 60_000],
  ["/movie/now_playing", 10 * 60_000],
  ["/movie/popular", 10 * 60_000],
  ["/movie/top_rated", 60 * 60_000],
  ["/movie/upcoming", 15 * 60_000],
  ["/discover/movie", 10 * 60_000],
  ["/search/movie", 5 * 60_000],
  ["/movie/", 6 * 60 * 60_000], // details + recommendations (immutable-ish)
];
function ttlFor(path: string): number {
  for (const [p, t] of TTL_BY_PREFIX) if (path.startsWith(p)) return t;
  return TTL_DEFAULT;
}

async function tmdb<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not configured");
  const url = new URL(`${TMDB_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) url.searchParams.set(k, String(v));
  }
  const cacheKey = `${path}?${url.searchParams.toString()}`;
  const now = Date.now();
  const hit = CACHE.get(cacheKey);
  if (hit && hit.expires > now) return hit.data as T;

  url.searchParams.set("api_key", key);
  const res = await fetch(url.toString(), {
    // Also let the platform fetch cache dedupe identical concurrent requests
    cf: { cacheTtl: Math.floor(ttlFor(path) / 1000), cacheEverything: true },
  } as RequestInit);
  if (!res.ok) {
    // On failure, serve stale if available
    if (hit) return hit.data as T;
    throw new Error(`TMDB ${path} ${res.status}`);
  }
  const data = (await res.json()) as T;
  if (CACHE.size >= MAX_ENTRIES) {
    const oldest = CACHE.keys().next().value;
    if (oldest) CACHE.delete(oldest);
  }
  CACHE.set(cacheKey, { expires: now + ttlFor(path), data });
  return data;
}

interface TmdbListItem {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  popularity?: number;
  genre_ids?: number[];
}

function normalizeList(items: TmdbListItem[]): Movie[] {
  return items
    .filter((it) => it.poster_path)
    .map((it): Movie => {
      const year = Number((it.release_date || it.first_air_date || "").slice(0, 4)) || 0;
      const genres = (it.genre_ids ?? [])
        .map((g) => GENRE_BY_ID[g])
        .filter((g): g is Genre => Boolean(g));
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
    });
}

function sortList(list: Movie[], sort?: string): Movie[] {
  const arr = [...list];
  switch (sort) {
    case "rating": return arr.sort((a, b) => b.rating - a.rating);
    case "year": return arr.sort((a, b) => b.year - a.year);
    case "title": return arr.sort((a, b) => a.title.localeCompare(b.title));
    default: return arr.sort((a, b) => b.popularity - a.popularity);
  }
}

export const getTrending = createServerFn({ method: "GET" }).handler(async () =>
  safe(async () => {
    const data = await tmdb<{ results: TmdbListItem[] }>("/trending/movie/week");
    const list = normalizeList(data.results);
    return list.length ? list : fbTrending();
  }, fbTrending),
);

export const getPopular = createServerFn({ method: "GET" }).handler(async () =>
  safe(async () => {
    const data = await tmdb<{ results: TmdbListItem[] }>("/movie/popular");
    const list = normalizeList(data.results);
    return list.length ? list : fbPopular();
  }, fbPopular),
);

export const getTopRated = createServerFn({ method: "GET" }).handler(async () =>
  safe(async () => {
    const data = await tmdb<{ results: TmdbListItem[] }>("/movie/top_rated");
    const list = normalizeList(data.results);
    return list.length ? list : fbTopRated();
  }, fbTopRated),
);

export const getUpcoming = createServerFn({ method: "GET" }).handler(async () =>
  safe(async () => {
    const data = await tmdb<{ results: TmdbListItem[] }>("/movie/upcoming");
    const list = normalizeList(data.results);
    return list.length ? list : fbUpcoming();
  }, fbUpcoming),
);

// Currently in cinemas
export const getNowPlaying = createServerFn({ method: "GET" }).handler(async () =>
  safe(async () => {
    const data = await tmdb<{ results: TmdbListItem[] }>("/movie/now_playing");
    const list = normalizeList(data.results);
    return list.length ? list : fbNewest();
  }, fbNewest),
);

// Freshly released titles (last 60 days), newest first
export const getLatestReleases = createServerFn({ method: "GET" }).handler(async () =>
  safe(async () => {
  const today = new Date();
  const from = new Date(today.getTime() - 60 * 24 * 60 * 60_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const data = await tmdb<{ results: TmdbListItem[] }>("/discover/movie", {
    sort_by: "primary_release_date.desc",
    "primary_release_date.gte": iso(from),
    "primary_release_date.lte": iso(today),
    "vote_count.gte": 20,
    include_adult: "false",
  });
  const list = normalizeList(data.results);
  return list.length ? list : fbNewest();
  }, fbNewest),
);

export const getByGenre = createServerFn({ method: "GET" })
  .inputValidator((d: { genre: string }) => z.object({ genre: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const id = GENRE_NAME_TO_ID[data.genre];
    if (!id) return fbByGenre(data.genre);
    return safe(async () => {
      const res = await tmdb<{ results: TmdbListItem[] }>("/discover/movie", {
        with_genres: id, sort_by: "popularity.desc", "vote_count.gte": 200,
      });
      const list = normalizeList(res.results);
      return list.length ? list : fbByGenre(data.genre);
    }, () => fbByGenre(data.genre));
  });

export const getMoodMovies = createServerFn({ method: "GET" })
  .inputValidator((d: { genres: string[] }) => z.object({ genres: z.array(z.string()) }).parse(d))
  .handler(async ({ data }) => {
    const ids = data.genres.map((g) => GENRE_NAME_TO_ID[g]).filter(Boolean).join("|");
    if (!ids) return fbByGenres(data.genres);
    return safe(async () => {
      const res = await tmdb<{ results: TmdbListItem[] }>("/discover/movie", {
        with_genres: ids, sort_by: "popularity.desc", "vote_count.gte": 100,
      });
      const list = normalizeList(res.results);
      return list.length ? list : fbByGenres(data.genres);
    }, () => fbByGenres(data.genres));
  });

export const discoverMovies = createServerFn({ method: "GET" })
  .inputValidator((d: { q?: string; genre?: string; year?: string; min?: number; sort?: string }) =>
    z.object({
      q: z.string().optional(),
      genre: z.string().optional(),
      year: z.string().optional(),
      min: z.number().optional(),
      sort: z.string().optional(),
    }).parse(d))
  .handler(async ({ data }) => safe(async () => {
    if (data.q && data.q.trim()) {
      const res = await tmdb<{ results: TmdbListItem[] }>("/search/movie", {
        query: data.q, include_adult: "false",
      });
      let list = normalizeList(res.results);
      if (data.genre) list = list.filter((m) => m.genres.includes(data.genre as Genre));
      if (data.year) list = list.filter((m) => String(m.year) === data.year);
      if (data.min) list = list.filter((m) => m.rating >= (data.min ?? 0));
      return sortList(list, data.sort);
    }
    const sortMap: Record<string, string> = {
      popularity: "popularity.desc",
      rating: "vote_average.desc",
      year: "primary_release_date.desc",
      title: "original_title.asc",
    };
    const res = await tmdb<{ results: TmdbListItem[] }>("/discover/movie", {
      with_genres: data.genre ? GENRE_NAME_TO_ID[data.genre] : undefined,
      primary_release_year: data.year || undefined,
      "vote_average.gte": data.min || undefined,
      "vote_count.gte": 100,
      sort_by: sortMap[data.sort || "popularity"] || "popularity.desc",
    });
    const list = normalizeList(res.results);
    return list.length ? list : fbDiscover(data);
  }, () => fbDiscover(data)));

interface TmdbDetails extends TmdbListItem {
  runtime?: number;
  genres?: { id: number; name: string }[];
  credits?: { cast?: { name: string }[]; crew?: { name: string; job: string }[] };
  videos?: { results?: { site: string; type: string; key: string; official?: boolean }[] };
  keywords?: { keywords?: { name: string }[] };
}

export const getMovieDetails = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }): Promise<Movie | null> => {
    try {
      const it = await tmdb<TmdbDetails>(`/movie/${data.id}`, {
        append_to_response: "credits,videos,keywords",
      });
      const year = Number((it.release_date || "").slice(0, 4)) || 0;
      const genres = (it.genres ?? [])
        .map((g) => g.name as Genre)
        .filter((g): g is Genre => Boolean(g));
      const director = it.credits?.crew?.find((c) => c.job === "Director")?.name || "";
      const cast = (it.credits?.cast ?? []).slice(0, 8).map((c) => c.name);
      const keywords = (it.keywords?.keywords ?? []).slice(0, 8).map((k) => k.name);
      const videos = it.videos?.results ?? [];
      const trailer =
        videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ||
        videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
        videos.find((v) => v.site === "YouTube");
      return {
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
        trailerYoutubeId: trailer?.key ?? null,
      };
    } catch {
      return fbDetails(data.id);
    }
  });

export const getSimilar = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const res = await tmdb<{ results: TmdbListItem[] }>(`/movie/${data.id}/recommendations`);
      const list = normalizeList(res.results);
      return list.length ? list : fbSimilar(data.id);
    } catch {
      return fbSimilar(data.id);
    }
  });

// ============================================================================
// Personalized recommendations (Phase 1 + 2): candidate pool from user seeds,
// enriched with details (director/cast/keywords), scored locally, explained.
// ============================================================================

async function fetchDetails(id: string): Promise<Movie | null> {
  try {
    const it = await tmdb<TmdbDetails>(`/movie/${id}`, {
      append_to_response: "credits,keywords",
    });
    const year = Number((it.release_date || "").slice(0, 4)) || 0;
    const genres = (it.genres ?? []).map((g) => g.name as Genre).filter((g): g is Genre => Boolean(g));
    return {
      id: String(it.id),
      title: it.title || it.name || "Untitled",
      year,
      genres,
      rating: Math.round((it.vote_average ?? 0) * 10) / 10,
      runtime: it.runtime ?? 0,
      overview: it.overview || "",
      director: it.credits?.crew?.find((c) => c.job === "Director")?.name || "",
      cast: (it.credits?.cast ?? []).slice(0, 8).map((c) => c.name),
      keywords: (it.keywords?.keywords ?? []).slice(0, 10).map((k) => k.name),
      popularity: Math.min(100, Math.round(it.popularity ?? 0)),
      posterHue: (it.id * 37) % 360,
      posterUrl: it.poster_path ? `${IMG}/w500${it.poster_path}` : null,
      backdropUrl: it.backdrop_path ? `${IMG}/original${it.backdrop_path}` : null,
      trailerYoutubeId: null,
    };
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const overlap = <T,>(a: readonly T[], b: readonly T[]) => a.filter((x) => b.includes(x)).length;

export interface ScoreBreakdown {
  genre: number;
  keyword: number;
  cast: number;
  director: number;
  year: number;
  popularity: number;
  quality: number;
  total: number;
}

export interface ScoredMovie {
  movie: Movie;
  score: number;
  breakdown: ScoreBreakdown;
  reason: string;
  matchedSeedId?: string;
  matchedSeedTitle?: string;
}

function contentSimVsSeeds(candidate: Movie, seeds: Movie[]): {
  breakdown: ScoreBreakdown;
  best: { seed: Movie; score: number } | null;
} {
  if (seeds.length === 0) {
    const quality = candidate.rating / 10;
    const popularity = candidate.popularity / 100;
    return {
      breakdown: { genre: 0, keyword: 0, cast: 0, director: 0, year: 0, popularity, quality, total: quality * 0.5 + popularity * 0.5 },
      best: null,
    };
  }
  let sumGenre = 0, sumKw = 0, sumCast = 0, sumDir = 0, sumYear = 0;
  let best: { seed: Movie; score: number } | null = null;
  for (const seed of seeds) {
    const g = overlap(candidate.genres, seed.genres) / Math.max(candidate.genres.length, seed.genres.length, 1);
    const k = overlap(candidate.keywords, seed.keywords) / Math.max(candidate.keywords.length, seed.keywords.length, 1);
    const c = overlap(candidate.cast, seed.cast) / Math.max(candidate.cast.length, seed.cast.length, 1);
    const d = seed.director && candidate.director === seed.director ? 1 : 0;
    const y = 1 - Math.min(Math.abs(candidate.year - seed.year) / 40, 1);
    const pair = g * 0.45 + k * 0.2 + c * 0.15 + d * 0.1 + y * 0.1;
    sumGenre += g; sumKw += k; sumCast += c; sumDir += d; sumYear += y;
    if (!best || pair > best.score) best = { seed, score: pair };
  }
  const n = seeds.length;
  const content = (sumGenre / n) * 0.45 + (sumKw / n) * 0.2 + (sumCast / n) * 0.15 + (sumDir / n) * 0.1 + (sumYear / n) * 0.1;
  const popularity = candidate.popularity / 100;
  const quality = candidate.rating / 10;
  const total = content * 0.6 + popularity * 0.2 + quality * 0.2;
  return {
    breakdown: {
      genre: sumGenre / n,
      keyword: sumKw / n,
      cast: sumCast / n,
      director: sumDir / n,
      year: sumYear / n,
      popularity,
      quality,
      total,
    },
    best,
  };
}

function buildReason(candidate: Movie, best: { seed: Movie; score: number } | null, ratings: Record<string, number>): string {
  if (!best) {
    if (candidate.rating >= 8) return `Top-rated pick — ${candidate.rating.toFixed(1)}/10 on TMDB`;
    return "Trending across the LumoroX catalog";
  }
  const seed = best.seed;
  const seedRating = ratings[seed.id];
  const dirMatch = seed.director && candidate.director === seed.director;
  const sharedCast = candidate.cast.filter((c) => seed.cast.includes(c));
  const sharedKw = candidate.keywords.filter((k) => seed.keywords.includes(k));
  const sharedGenres = candidate.genres.filter((g) => seed.genres.includes(g));

  if (dirMatch) return `Directed by ${candidate.director}, like ${seed.title}`;
  if (sharedCast.length > 0) return `Stars ${sharedCast[0]}, like ${seed.title}`;
  if (sharedKw.length >= 2) return `Shares themes (${sharedKw.slice(0, 2).join(", ")}) with ${seed.title}`;
  if (seedRating && seedRating >= 8) return `Because you rated ${seed.title} ${seedRating}/10`;
  if (sharedGenres.length > 0) return `${sharedGenres.slice(0, 2).join(" · ")} — like ${seed.title}`;
  return `Similar in feel to ${seed.title}`;
}

export const getPersonalizedRecommendations = createServerFn({ method: "POST" })
  .inputValidator((d: {
    likes: string[];
    dislikes: string[];
    watchlist: string[];
    ratings: Record<string, number>;
  }) => z.object({
    likes: z.array(z.string()),
    dislikes: z.array(z.string()),
    watchlist: z.array(z.string()),
    ratings: z.record(z.string(), z.number()),
  }).parse(d))
  .handler(async ({ data }): Promise<ScoredMovie[]> => {
    // Build seed IDs: liked + highly rated (>=7), cap to 6 to control API cost
    const highlyRated = Object.entries(data.ratings).filter(([, r]) => r >= 7).map(([id]) => id);
    const seedIds = Array.from(new Set([...data.likes, ...highlyRated])).slice(0, 6);

    if (seedIds.length === 0) {
      // Cold start: return trending as ScoredMovie w/ generic reasons
      const trending = await safe(
        async () => {
          const r = await tmdb<{ results: TmdbListItem[] }>("/trending/movie/week");
          const l = normalizeList(r.results);
          return l.length ? l : fbTrending();
        },
        fbTrending,
      );
      return trending.slice(0, 24).map((m): ScoredMovie => ({
        movie: m,
        score: m.rating / 10 * 0.5 + m.popularity / 100 * 0.5,
        breakdown: { genre: 0, keyword: 0, cast: 0, director: 0, year: 0, popularity: m.popularity / 100, quality: m.rating / 10, total: 0 },
        reason: m.rating >= 8 ? `Top-rated — ${m.rating.toFixed(1)}/10 on TMDB` : "Trending this week",
      }));
    }

    // 1. Fetch seed details (enriched) in parallel
    const seeds = (await Promise.all(seedIds.map((id) => fetchDetails(id)))).filter((m): m is Movie => Boolean(m));

    // 2. Fetch TMDB recommendations for each seed in parallel
    const recLists = await Promise.all(
      seedIds.map(async (id) => {
        try {
          const res = await tmdb<{ results: TmdbListItem[] }>(`/movie/${id}/recommendations`);
          return normalizeList(res.results);
        } catch { return [] as Movie[]; }
      }),
    );

    // 3. Merge unique, filter blocked
    const blocked = new Set([...data.dislikes, ...data.likes, ...data.watchlist]);
    const merged = new Map<string, Movie>();
    for (const list of recLists) {
      for (const m of list) {
        if (blocked.has(m.id) || merged.has(m.id)) continue;
        merged.set(m.id, m);
      }
    }

    // 4. Cap candidate pool for enrichment (avoid API blowup)
    const pool = Array.from(merged.values())
      .sort((a, b) => (b.rating * 0.6 + b.popularity / 100 * 0.4) - (a.rating * 0.6 + a.popularity / 100 * 0.4))
      .slice(0, 36);

    // 5. Enrich each candidate with details in parallel (cached; concurrency capped)
    const enriched = (await mapWithConcurrency(pool, 6, (m) => fetchDetails(m.id)))
      .filter((m): m is Movie => Boolean(m));

    // 6. Score
    const scored: ScoredMovie[] = enriched.map((cand) => {
      const { breakdown, best } = contentSimVsSeeds(cand, seeds);
      return {
        movie: cand,
        score: breakdown.total,
        breakdown,
        reason: buildReason(cand, best, data.ratings),
        matchedSeedId: best?.seed.id,
        matchedSeedTitle: best?.seed.title,
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 24);
  });

