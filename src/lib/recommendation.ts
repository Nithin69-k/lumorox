import { MOVIES, MOVIES_BY_ID, type Movie } from "@/data/movies";
import { MOODS, type MoodId } from "@/data/genres";

const overlap = <T,>(a: readonly T[], b: readonly T[]) => a.filter((x) => b.includes(x)).length;

/** Content-based similarity 0..1 */
export function contentSimilarity(a: Movie, b: Movie): number {
  if (a.id === b.id) return 0;
  const genreScore = overlap(a.genres, b.genres) / Math.max(a.genres.length, b.genres.length);
  const kwScore = overlap(a.keywords, b.keywords) / Math.max(a.keywords.length, b.keywords.length, 1);
  const castScore = overlap(a.cast, b.cast) / Math.max(a.cast.length, b.cast.length, 1);
  const dirScore = a.director === b.director ? 1 : 0;
  const yearScore = 1 - Math.min(Math.abs(a.year - b.year) / 40, 1);
  return genreScore * 0.45 + kwScore * 0.2 + castScore * 0.15 + dirScore * 0.1 + yearScore * 0.1;
}

/** Hybrid: content + popularity + (optional) collaborative-style user signals */
export interface UserSignals {
  likes: string[];
  dislikes: string[];
  watchlist: string[];
  ratings: Record<string, number>; // 0..10
}

export const EMPTY_SIGNALS: UserSignals = { likes: [], dislikes: [], watchlist: [], ratings: {} };

export function similarTo(movieId: string, limit = 12): Movie[] {
  const target = MOVIES_BY_ID.get(movieId);
  if (!target) return [];
  return MOVIES.map((mv) => ({ mv, score: contentSimilarity(target, mv) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.mv);
}

export function recommendFor(signals: UserSignals, limit = 18): Movie[] {
  const liked = signals.likes.map((id) => MOVIES_BY_ID.get(id)).filter(Boolean) as Movie[];
  const ratedHigh = Object.entries(signals.ratings).filter(([, r]) => r >= 7).map(([id]) => MOVIES_BY_ID.get(id)).filter(Boolean) as Movie[];
  const profile = [...liked, ...ratedHigh];
  const blocked = new Set([...signals.dislikes, ...signals.likes, ...signals.watchlist]);

  if (profile.length === 0) {
    return [...MOVIES].sort((a, b) => b.popularity - a.popularity).slice(0, limit);
  }

  const scored = MOVIES.filter((mv) => !blocked.has(mv.id)).map((mv) => {
    const content = profile.reduce((s, p) => s + contentSimilarity(p, mv), 0) / profile.length;
    const popularity = mv.popularity / 100;
    const quality = mv.rating / 10;
    const score = content * 0.6 + popularity * 0.2 + quality * 0.2;
    return { mv, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.mv);
}

export function moodRecommendations(mood: MoodId, limit = 18): Movie[] {
  const def = MOODS.find((m) => m.id === mood);
  if (!def) return [];
  return MOVIES.filter((mv) => mv.genres.some((g) => (def.genres as readonly string[]).includes(g)))
    .sort((a, b) => b.rating * 0.6 + b.popularity * 0.04 - (a.rating * 0.6 + a.popularity * 0.04))
    .slice(0, limit);
}

export const trending = (limit = 18) => [...MOVIES].sort((a, b) => b.popularity - a.popularity).slice(0, limit);
export const topRated = (limit = 18) => [...MOVIES].sort((a, b) => b.rating - a.rating).slice(0, limit);
export const popular = (limit = 18) =>
  [...MOVIES].sort((a, b) => (b.popularity + b.rating * 5) - (a.popularity + a.rating * 5)).slice(0, limit);
export const upcoming = (limit = 18) => [...MOVIES].filter((m) => m.year >= 2023).sort((a, b) => b.year - a.year).slice(0, limit);
export const byGenre = (genre: string, limit = 24) =>
  MOVIES.filter((m) => (m.genres as readonly string[]).includes(genre)).sort((a, b) => b.rating - a.rating).slice(0, limit);
