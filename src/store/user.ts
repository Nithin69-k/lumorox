import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserSignals } from "@/lib/recommendation";

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
      },
      inWatchlist: (id) => get().watchlist.includes(id),
      isLiked: (id) => get().likes.includes(id),
      isDisliked: (id) => get().dislikes.includes(id),
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
