import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { useUserStore } from "@/store/user";
import { getSimilar, getTrending } from "@/lib/tmdb.functions";
import type { Movie } from "@/data/movies";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "Personalized Recommendations — CineVerse AI" },
      { name: "description", content: "Recommendations tuned to your taste, powered by TMDB and your watch signals." },
      { property: "og:title", content: "Personalized Recommendations — CineVerse AI" },
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

  const seeds = Array.from(
    new Set([
      ...likes,
      ...Object.entries(ratings).filter(([, r]) => r >= 7).map(([id]) => id),
    ]),
  ).slice(0, 4);

  const { data: recs = [], isFetching } = useQuery({
    queryKey: ["tmdb", "recs", seeds.join(",")],
    queryFn: async () => {
      if (seeds.length === 0) return getTrending();
      const lists = await Promise.all(seeds.map((id) => getSimilar({ data: { id } })));
      const blocked = new Set([...dislikes, ...likes, ...watchlist]);
      const merged: Movie[] = [];
      const seen = new Set<string>();
      const max = Math.max(...lists.map((l) => l.length));
      for (let i = 0; i < max; i++) {
        for (const l of lists) {
          const m = l[i];
          if (!m || seen.has(m.id) || blocked.has(m.id)) continue;
          seen.add(m.id);
          merged.push(m);
        }
      }
      return merged.slice(0, 30);
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl brand-gradient shadow-[var(--shadow-glow)]">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">For You</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {seeds.length > 0
              ? `Based on ${seeds.length} title${seeds.length > 1 ? "s" : ""} you liked or rated highly…`
              : "Like a few movies and rate some titles to personalize this list."}
          </p>
        </div>
      </div>

      {seeds.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-6">
          <p className="text-sm text-muted-foreground">
            Tip: open any movie and tap thumbs-up or rate it. We'll blend TMDB's recommendation graph with your taste profile in real time.
          </p>
          <Link to="/" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">Browse the catalog →</Link>
        </div>
      )}

      {isFetching && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Curating picks for you…
        </p>
      )}

      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {recs.map((m, i) => <MovieCard key={m.id} movie={m} index={i} className="w-full" />)}
      </div>
    </div>
  );
}
