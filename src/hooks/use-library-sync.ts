import { useEffect, useRef } from "react";
import { useUserStore } from "@/store/user";
import { useAuth } from "@/hooks/use-auth";
import { syncLibrary, getMyLibrary } from "@/lib/user-data.functions";
import { toast } from "sonner";

/**
 * When the user signs in, push local library to server once (merging), then
 * pull server library back so both sides converge. Keeps zustand as the client
 * source of truth for offline reads.
 */
export function useLibrarySync() {
  const { isAuthenticated, user } = useAuth();
  const ratings = useUserStore((s) => s.ratings);
  const watchlist = useUserStore((s) => s.watchlist);
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (syncedFor.current === user.id) return;
    syncedFor.current = user.id;
    (async () => {
      try {
        if (Object.keys(ratings).length || watchlist.length) {
          await syncLibrary({ data: { ratings, watchlist } });
        }
        const { ratings: dbR, watchlist: dbW } = await getMyLibrary();
        const store = useUserStore.getState();
        // merge server data (server wins on conflict)
        useUserStore.setState({
          ratings: { ...store.ratings, ...dbR },
          watchlist: Array.from(new Set([...store.watchlist, ...dbW])),
        });
        toast.success("Library synced");
      } catch (err) {
        console.error("library sync failed", err);
      }
    })();
  }, [isAuthenticated, user, ratings, watchlist]);
}
