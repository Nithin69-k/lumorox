import { MOVIES, MOVIES_BY_ID, type Movie } from "@/data/movies";
import type { Genre } from "@/data/genres";

// Local catalogue fallback. Used whenever TMDB is unreachable or
// TMDB_API_KEY is not configured in the deployment environment, so the
// site always renders content instead of throwing to an error boundary.

export async function safe<T>(run: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error("[tmdb] falling back to local catalogue:", error);
    return fallback();
  }
}

const byPopularity = () => [...MOVIES].sort((a, b) => b.popularity - a.popularity);

export const fbTrending = () => byPopularity().slice(0, 20);
export const fbPopular = () => byPopularity().slice(0, 24);
export const fbTopRated = () => [...MOVIES].sort((a, b) => b.rating - a.rating).slice(0, 24);
export const fbNewest = () => [...MOVIES].sort((a, b) => b.year - a.year).slice(0, 24);
export const fbUpcoming = () => fbNewest();

export const fbByGenre = (genre: string) =>
  byPopularity().filter((m) => m.genres.includes(genre as Genre)).slice(0, 24);

export const fbByGenres = (genres: string[]) =>
  byPopularity().filter((m) => m.genres.some((g) => genres.includes(g))).slice(0, 24);

export function fbDiscover(params: { q?: string; genre?: string; year?: string; min?: number; sort?: string }): Movie[] {
  let list = [...MOVIES];
  if (params.q?.trim()) {
    const q = params.q.trim().toLowerCase();
    list = list.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.overview.toLowerCase().includes(q) ||
        m.cast.some((c) => c.toLowerCase().includes(q)) ||
        m.director.toLowerCase().includes(q) ||
        m.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }
  if (params.genre) list = list.filter((m) => m.genres.includes(params.genre as Genre));
  if (params.year) list = list.filter((m) => String(m.year) === params.year);
  if (params.min) list = list.filter((m) => m.rating >= (params.min ?? 0));
  switch (params.sort) {
    case "rating": return list.sort((a, b) => b.rating - a.rating);
    case "year": return list.sort((a, b) => b.year - a.year);
    case "title": return list.sort((a, b) => a.title.localeCompare(b.title));
    default: return list.sort((a, b) => b.popularity - a.popularity);
  }
}

export const fbDetails = (id: string): Movie | null => MOVIES_BY_ID.get(id) ?? null;

export function fbSimilar(id: string): Movie[] {
  const seed = MOVIES_BY_ID.get(id);
  if (!seed) return fbTrending();
  return MOVIES.filter((m) => m.id !== id)
    .map((m) => ({ m, s: m.genres.filter((g) => seed.genres.includes(g)).length }))
    .sort((a, b) => b.s - a.s || b.m.popularity - a.m.popularity)
    .slice(0, 12)
    .map((x) => x.m);
}
