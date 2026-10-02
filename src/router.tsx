import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep catalogue data fresh: revalidate every 15 minutes and whenever
        // the user comes back to the tab / regains connectivity.
        staleTime: 15 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // Background refresh every 30 min so open tabs stay current without reloads.
        refetchInterval: 30 * 60_000,
        refetchIntervalInBackground: false,
        // Keep showing the previous data while a refresh is in flight (no flicker).
        placeholderData: (prev: unknown) => prev,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
