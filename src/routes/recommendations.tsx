import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, BarChart3, Users } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { MovieGridSkeleton } from "@/components/MovieCardSkeleton";
import { useUserStore } from "@/store/user";
import { getPersonalizedRecommendations } from "@/lib/tmdb.functions";
import { getCollaborativeRecommendations } from "@/lib/user-data.functions";
import { useAuth } from "@/hooks/use-auth";
import { useLibrarySync } from "@/hooks/use-library-sync";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "Personalized Recommendations — LumoroX AI" },
      { name: "description", content: "Recommendations tuned to your taste with content-based scoring and explainable reasons." },
      { property: "og:title", content: "Personalized Recommendations — LumoroX AI" },
      { property: "og:url", content: "/recommendations" },
    ],
    links: [{ rel: "canonical", href: "/recommendations" }],
  }),
  component: RecPage,
});

function RecPage() {
  const likes = useUserStore((s) => s.likes);
  const watchlist = useUserStore((s) => s.watchlist);
  const dislikes = useUserStore((s) => s.dislikes);
  const ratings = useUserStore((s) => s.ratings);
  const { isAuthenticated } = useAuth();
  useLibrarySync();

  const highlyRatedCount = Object.values(ratings).filter((r) => r >= 7).length;
  const seedCount = new Set([
    ...likes,
    ...Object.entries(ratings).filter(([, r]) => r >= 7).map(([id]) => id),
  ]).size;

  const { data: collab = [], isFetching: collabLoading } = useQuery({
    queryKey: ["recs", "collab", isAuthenticated],
    queryFn: () => getCollaborativeRecommendations({ data: { limit: 12 } }),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  const { data: recs = [], isFetching, isSuccess } = useQuery({
    queryKey: ["recs", "personalized", likes.join(","), dislikes.join(","), watchlist.join(","), JSON.stringify(ratings)],
    queryFn: () => getPersonalizedRecommendations({
      data: { likes, dislikes, watchlist, ratings },
    }),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl brand-gradient shadow-[var(--shadow-glow)]">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-4xl tracking-tight sm:text-5xl">For You</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {seedCount > 0
                ? `Scored against ${seedCount} title${seedCount > 1 ? "s" : ""} you liked${highlyRatedCount > 0 ? ` or rated highly` : ""} · content-based similarity`
                : "Like a few movies and rate some titles to personalize this list."}
            </p>
          </div>
        </div>
        {recs.length > 0 && (
          <Link
            to="/metrics"
            className="hidden items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-brand hover:text-brand sm:inline-flex"
          >
            <BarChart3 className="h-4 w-4" /> Scoring metrics
          </Link>
        )}
      </div>

      {seedCount === 0 && !isFetching && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full brand-gradient">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h2 className="mt-4 font-display text-2xl">No taste profile yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Open any movie and tap thumbs-up, or rate a few titles 7+ out of 10. We'll blend TMDB's recommendation graph with content signals (director, cast, keywords, genre) and explain every pick.
          </p>
          <Link to="/" className="mt-5 inline-flex rounded-md brand-gradient px-4 py-2 text-sm font-semibold text-white">
            Browse the catalog
          </Link>
        </div>
      )}

      {isFetching && seedCount > 0 && (
        <div className="mt-8">
          <MovieGridSkeleton count={12} />
        </div>
      )}

      {isSuccess && recs.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {recs.map((r, i) => (
            <MovieCard key={r.movie.id} movie={r.movie} index={i} reason={r.reason} className="w-full" />
          ))}
        </div>
      )}

      {isSuccess && recs.length === 0 && seedCount > 0 && (
        <p className="mt-8 text-sm text-muted-foreground">No new recommendations right now — try liking more titles.</p>
      )}
    </div>
  );
}
