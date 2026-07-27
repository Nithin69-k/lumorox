import { useEffect, useRef } from "react";
import { useUserStore } from "@/store/user";
import { useAuth } from "@/hooks/use-auth";
import { syncLibrary, getMyLibrary } from "@/lib/user-data.functions";
import { retry } from "@/lib/sync-retry";
import { toast } from "sonner";

/**
 * On sign-in: push the local library to the server once (merge), then pull the
 * server copy back so both sides converge.
 *
 * Conflict rules:
 *  - watchlist: union (additive, never destructive)
 *  - ratings:   server value wins for movies rated on both sides, since the
 *               server row is the shared/latest record across devices
 * Failures are retried with backoff; local state is never destroyed on failure.
 */
export function useLibrarySync() {
  const { isAuthenticated, user } = useAuth();
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (syncedFor.current === user.id) return;
    syncedFor.current = user.id;

    const controller = new AbortController();

    (async () => {
      // snapshot local state at sync time (not a reactive dep)
      const { ratings, watchlist } = useUserStore.getState();
      try {
        if (Object.keys(ratings).length || watchlist.length) {
          await retry(() => syncLibrary({ data: { ratings, watchlist } }), {
            signal: controller.signal,
          });
        }
        const { ratings: dbR, watchlist: dbW } = await retry(() => getMyLibrary(), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        useUserStore.setState((s) => ({
          ratings: { ...s.ratings, ...dbR }, // server wins on conflict
          watchlist: Array.from(new Set([...s.watchlist, ...dbW])),
        }));
        toast.success("Library synced");
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("library sync failed", err);
        syncedFor.current = null; // allow a retry on next auth change / remount
        toast.error("Couldn't sync your library", {
          description: "Your saved titles are still safe on this device.",
        });
      }
    })();

    return () => controller.abort();
  }, [isAuthenticated, user]);
}
