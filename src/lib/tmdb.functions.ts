import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Movie } from "@/data/movies";
import type { Genre } from "@/data/genres";

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

// TTLs (ms) tuned per endpoint volatility
const TTL_DEFAULT = 10 * 60_000;
const TTL_BY_PREFIX: Array<[string, number]> = [
  ["/trending", 30 * 60_000],
  ["/movie/popular", 60 * 60_000],
  ["/movie/top_rated", 6 * 60 * 60_000],
  ["/movie/upcoming", 60 * 60_000],
  ["/discover/movie", 30 * 60_000],
  ["/search/movie", 10 * 60_000],
  ["/movie/", 6 * 60 * 60_000], // details + recommendations
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

export const getTrending = createServerFn({ method: "GET" }).handler(async () => {
  const data = await tmdb<{ results: TmdbListItem[] }>("/trending/movie/week");
  return normalizeList(data.results);
});

export const getPopular = createServerFn({ method: "GET" }).handler(async () => {
  const data = await tmdb<{ results: TmdbListItem[] }>("/movie/popular");
  return normalizeList(data.results);
});

export const getTopRated = createServerFn({ method: "GET" }).handler(async () => {
  const data = await tmdb<{ results: TmdbListItem[] }>("/movie/top_rated");
  return normalizeList(data.results);
});

export const getUpcoming = createServerFn({ method: "GET" }).handler(async () => {
  const data = await tmdb<{ results: TmdbListItem[] }>("/movie/upcoming");
  return normalizeList(data.results);
});

export const getByGenre = createServerFn({ method: "GET" })
  .inputValidator((d: { genre: string }) => z.object({ genre: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const id = GENRE_NAME_TO_ID[data.genre];
    if (!id) return [] as Movie[];
    const res = await tmdb<{ results: TmdbListItem[] }>("/discover/movie", {
      with_genres: id, sort_by: "popularity.desc", "vote_count.gte": 200,
    });
    return normalizeList(res.results);
  });

export const getMoodMovies = createServerFn({ method: "GET" })
  .inputValidator((d: { genres: string[] }) => z.object({ genres: z.array(z.string()) }).parse(d))
  .handler(async ({ data }) => {
    const ids = data.genres.map((g) => GENRE_NAME_TO_ID[g]).filter(Boolean).join("|");
    if (!ids) return [] as Movie[];
    const res = await tmdb<{ results: TmdbListItem[] }>("/discover/movie", {
      with_genres: ids, sort_by: "popularity.desc", "vote_count.gte": 100,
    });
    return normalizeList(res.results);
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
  .handler(async ({ data }) => {
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
    return normalizeList(res.results);
  });

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
      return null;
    }
  });

export const getSimilar = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const res = await tmdb<{ results: TmdbListItem[] }>(`/movie/${data.id}/recommendations`);
      return normalizeList(res.results);
    } catch {
      return [] as Movie[];
    }
  });
