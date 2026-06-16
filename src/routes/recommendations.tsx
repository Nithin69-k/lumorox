import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { recommendFor } from "@/lib/recommendation";
import { useUserStore } from "@/store/user";
import { MOVIES_BY_ID } from "@/data/movies";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "Personalized Recommendations — CineVerse AI" },
      { name: "description", content: "Hybrid content + collaborative AI recommendations tuned to your taste." },
      { property: "og:title", content: "Personalized Recommendations — CineVerse AI" },
      { property: "og:url", content: "/recommendations" },
    ],
    links: [{ rel: "canonical", href: "/recommendations" }],
  }),
  component: RecPage,
});

function RecPage() {
  const signals = useUserStore((s) => ({ likes: s.likes, dislikes: s.dislikes, watchlist: s.watchlist, ratings: s.ratings }));
  const recs = recommendFor(signals, 30);
  const seedTitles = signals.likes
    .map((id) => MOVIES_BY_ID.get(id)?.title)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl brand-gradient shadow-[var(--shadow-glow)]">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">For You</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {seedTitles.length > 0
              ? `Because you liked ${seedTitles.join(", ")}…`
              : "Like a few movies and rate some titles to personalize this list."}
          </p>
        </div>
      </div>

      {signals.likes.length + Object.keys(signals.ratings).length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-6">
          <p className="text-sm text-muted-foreground">
            Tip: open any movie and tap thumbs-up or rate it. Our hybrid engine blends content similarity, popularity, and your taste profile in real time.
          </p>
          <Link to="/" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">Browse the catalog →</Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {recs.map((m, i) => <MovieCard key={m.id} movie={m} index={i} className="w-full" />)}
      </div>
    </div>
  );
}
