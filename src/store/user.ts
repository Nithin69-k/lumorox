import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserSignals } from "@/lib/recommendation";
import { supabase } from "@/integrations/supabase/client";
import { retry, enqueue } from "@/lib/sync-retry";
import { toast } from "sonner";

interface State extends UserSignals {
  toggleWatchlist: (id: string) => void;
  toggleLike: (id: string) => void;
  toggleDislike: (id: string) => void;
  rate: (id: string, rating: number) => void;
  inWatchlist: (id: string) => boolean;
  isLiked: (id: string) => boolean;
  isDisliked: (id: string) => boolean;
  /** ids/keys with an in-flight background write */
  pending: string[];
}

async function signedIn() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

function setPending(key: string, on: boolean) {
  useUserStore.setState((s) => ({
    pending: on
      ? s.pending.includes(key) ? s.pending : [...s.pending, key]
      : s.pending.filter((k) => k !== key),
  }));
}

/**
 * Mirror a rating to Postgres with retries. On permanent failure the optimistic
 * local change is rolled back to `previous`.
 */
async function mirrorRating(tmdbId: string, rating: number, previous: number | undefined) {
  if (!(await signedIn())) return;
  const key = `rating:${tmdbId}`;
  setPending(key, true);
  try {
    await enqueue(key, () =>
      retry(async () => {
        const { saveRating } = await import("@/lib/user-data.functions");
        return saveRating({ data: { tmdbId, rating } });
      }),
    );
  } catch (err) {
    console.error("rating sync failed", err);
    // rollback only if the value we wrote is still the current one
    useUserStore.setState((s) => {
      if (s.ratings[tmdbId] !== rating) return s;
      const next = { ...s.ratings };
      if (previous === undefined) delete next[tmdbId];
      else next[tmdbId] = previous;
      return { ratings: next };
    });
    toast.error("Couldn't save your rating", { description: "We restored the previous value." });
  } finally {
    setPending(key, false);
  }
}

async function mirrorWatchlist(tmdbId: string, add: boolean) {
  if (!(await signedIn())) return;
  const key = `watchlist:${tmdbId}`;
  setPending(key, true);
  try {
    await enqueue(key, () =>
      retry(async () => {
        const { toggleWatchlistDb } = await import("@/lib/user-data.functions");
        return toggleWatchlistDb({ data: { tmdbId, add } });
      }),
    );
  } catch (err) {
    console.error("watchlist sync failed", err);
    useUserStore.setState((s) => {
      const nowIn = s.watchlist.includes(tmdbId);
      if (nowIn !== add) return s; // user already changed their mind — leave it
      return {
        watchlist: add ? s.watchlist.filter((x) => x !== tmdbId) : [...s.watchlist, tmdbId],
      };
    });
    toast.error("Couldn't update your watchlist", { description: "The change was undone." });
  } finally {
    setPending(key, false);
  }
}

export const useUserStore = create<State>()(
  persist(
    (set, get) => ({
      likes: [],
      dislikes: [],
      watchlist: [],
      ratings: {},
      pending: [],
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
        const previous = get().ratings[id];
        set((s) => ({ ratings: { ...s.ratings, [id]: rating } }));
        void mirrorRating(id, rating, previous);
      },
      inWatchlist: (id) => get().watchlist.includes(id),
      isLiked: (id) => get().likes.includes(id),
      isDisliked: (id) => get().isDisliked ? get().dislikes.includes(id) : get().dislikes.includes(id),
      pendingFor: undefined,
    }) as State,
    {
      name: "lumorox-user-v1",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage))),
      partialize: (s) => ({
        likes: s.likes,
        dislikes: s.dislikes,
        watchlist: s.watchlist,
        ratings: s.ratings,
      }) as unknown as State,
    },
  ),
);

export const useIsSyncing = (key: string) => useUserStore((s) => s.pending.includes(key));
