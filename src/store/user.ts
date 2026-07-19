import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserSignals } from "@/lib/recommendation";
import { supabase } from "@/integrations/supabase/client";

interface State extends UserSignals {
  toggleWatchlist: (id: string) => void;
  toggleLike: (id: string) => void;
  toggleDislike: (id: string) => void;
  rate: (id: string, rating: number) => void;
  inWatchlist: (id: string) => boolean;
  isLiked: (id: string) => boolean;
  isDisliked: (id: string) => boolean;
}

// Best-effort background mirror to Postgres when signed in.
// Failures are silent — local zustand remains the client source of truth.
async function mirrorRating(tmdbId: string, rating: number) {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const { saveRating } = await import("@/lib/user-data.functions");
    await saveRating({ data: { tmdbId, rating } });
  } catch { /* ignore */ }
}

async function mirrorWatchlist(tmdbId: string, add: boolean) {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const { toggleWatchlistDb } = await import("@/lib/user-data.functions");
    await toggleWatchlistDb({ data: { tmdbId, add } });
  } catch { /* ignore */ }
}

export const useUserStore = create<State>()(
  persist(
    (set, get) => ({
      likes: [],
      dislikes: [],
      watchlist: [],
      ratings: {},
      toggleWatchlist: (id) => {
        const has = get().watchlist.includes(id);
        set((s) => ({
          watchlist: has ? s.watchlist.filter((x) => x !== id) : [...s.watchlist, id],
        }));
        void mirrorWatchlist(id, !has);
      },
      toggleLike: (id) =>
        set((s) => ({
          likes: s.likes.includes(id) ? s.likes.filter((x) => x !== id) : [...s.likes, id],
          dislikes: s.dislikes.filter((x) => x !== id),
        })),
      toggleDislike: (id) =>
        set((s) => ({
          dislikes: s.dislikes.includes(id) ? s.dislikes.filter((x) => x !== id) : [...s.dislikes, id],
          likes: s.likes.filter((x) => x !== id),
        })),
      rate: (id, rating) => {
        set((s) => ({ ratings: { ...s.ratings, [id]: rating } }));
        void mirrorRating(id, rating);
      },
      inWatchlist: (id) => get().watchlist.includes(id),
      isLiked: (id) => get().likes.includes(id),
      isDisliked: (id) => get().dislikes.includes(id),
    }),
    {
      name: "lumorox-user-v1",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage))),
    },
  ),
);
