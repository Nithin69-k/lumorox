import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

async function hydrateMovie(id: string): Promise<Movie | null> {
  try {
    const key = process.env.TMDB_API_KEY;
    if (!key) return null;
    const res = await fetch(`${TMDB_BASE}/movie/${id}?api_key=${key}`, {
      cf: { cacheTtl: 3600, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) return null;
    const it = await res.json() as {
      id: number; title?: string; release_date?: string; poster_path?: string | null;
      backdrop_path?: string | null; overview?: string; vote_average?: number;
      popularity?: number; genres?: { id: number; name: string }[];
    };
    const year = Number((it.release_date || "").slice(0, 4)) || 0;
    const genres = (it.genres ?? []).map((g) => GENRE_BY_ID[g.id]).filter((g): g is Genre => Boolean(g));
    return {
      id: String(it.id),
      title: it.title || "Untitled",
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
  } catch {
    return null;
  }
}

// Save a rating
export const saveRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tmdbId: string; rating: number }) =>
    z.object({ tmdbId: z.string(), rating: z.number().int().min(1).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_ratings" as never)
      .upsert({
        user_id: context.userId,
        tmdb_id: data.tmdbId,
        rating: data.rating,
        updated_at: new Date().toISOString(),
      } as never, { onConflict: "user_id,tmdb_id" });
    if (error) throw error;
    return { ok: true };
  });

// Toggle watchlist entry
export const toggleWatchlistDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tmdbId: string; add: boolean }) =>
    z.object({ tmdbId: z.string(), add: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.add) {
      const { error } = await context.supabase
        .from("user_watchlist" as never)
        .upsert({ user_id: context.userId, tmdb_id: data.tmdbId } as never, { onConflict: "user_id,tmdb_id" });
      if (error) throw error;
    } else {
      const { error } = await context.supabase
        .from("user_watchlist" as never)
        .delete()
        .eq("user_id", context.userId)
        .eq("tmdb_id", data.tmdbId);
      if (error) throw error;
    }
    return { ok: true };
  });

// Load my library (ratings + watchlist)
export const getMyLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [ratingsRes, watchlistRes] = await Promise.all([
      context.supabase.from("user_ratings" as never).select("tmdb_id, rating").eq("user_id", context.userId),
      context.supabase.from("user_watchlist" as never).select("tmdb_id").eq("user_id", context.userId),
    ]);
    const ratings: Record<string, number> = {};
    for (const row of (ratingsRes.data as { tmdb_id: string; rating: number }[] | null) ?? []) {
      ratings[row.tmdb_id] = row.rating;
    }
    const watchlist = ((watchlistRes.data as { tmdb_id: string }[] | null) ?? []).map((r) => r.tmdb_id);
    return { ratings, watchlist };
  });

// Bulk push local library to server (initial sync when signing in)
export const syncLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ratings: Record<string, number>; watchlist: string[] }) =>
    z.object({
      ratings: z.record(z.string(), z.number().int().min(1).max(10)),
      watchlist: z.array(z.string()),
    }).parse(d))
  .handler(async ({ data, context }) => {
    // Conflict rule: the server row is authoritative. Only push local ratings
    // for movies that have no server row yet, so a stale device can't clobber
    // a newer rating made elsewhere. Watchlist is additive (union).
    const { data: existing } = await context.supabase
      .from("user_ratings" as never)
      .select("tmdb_id")
      .eq("user_id", context.userId);
    const known = new Set(
      ((existing as { tmdb_id: string }[] | null) ?? []).map((r) => r.tmdb_id),
    );

    const ratingRows = Object.entries(data.ratings)
      .filter(([tmdb_id]) => !known.has(tmdb_id))
      .map(([tmdb_id, rating]) => ({
        user_id: context.userId, tmdb_id, rating, updated_at: new Date().toISOString(),
      }));
    const watchRows = data.watchlist.map((tmdb_id) => ({ user_id: context.userId, tmdb_id }));
    if (ratingRows.length) {
      const { error } = await context.supabase
        .from("user_ratings" as never)
        .upsert(ratingRows as never, { onConflict: "user_id,tmdb_id" });
      if (error) throw error;
    }
    if (watchRows.length) {
      const { error } = await context.supabase
        .from("user_watchlist" as never)
        .upsert(watchRows as never, { onConflict: "user_id,tmdb_id", ignoreDuplicates: true });
      if (error) throw error;
    }
    return { ok: true, ratings: ratingRows.length, watchlist: watchRows.length };
  });


// Collaborative filtering recommendations
export interface CollabRec {
  movie: Movie;
  score: number;
  coRaters: number;
  reason: string;
}

export const getCollaborativeRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number }) => z.object({ limit: z.number().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<CollabRec[]> => {
    const limit = data.limit ?? 18;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc(
      "collaborative_recommendations" as never,
      { _user_id: context.userId, _limit: limit } as never,
    );
    if (error) {
      console.error("collab rpc failed", error);
      return [];
    }
    const typed = (rows as { tmdb_id: string; score: number; co_raters: number }[] | null) ?? [];
    if (typed.length === 0) return [];
    const hydrated = await Promise.all(typed.map(async (r) => {
      const movie = await hydrateMovie(r.tmdb_id);
      if (!movie) return null;
      const raters = Number(r.co_raters);
      return {
        movie,
        score: r.score,
        coRaters: raters,
        reason: raters > 1
          ? `Loved by ${raters} viewers with taste like yours`
          : `Highly rated by a viewer who shares your taste`,
      } as CollabRec;
    }));
    return hydrated.filter((x): x is CollabRec => Boolean(x));
  });
