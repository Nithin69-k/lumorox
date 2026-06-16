import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { MOVIES_BY_ID } from "@/data/movies";
import { useUserStore } from "@/store/user";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "My Watchlist — CineVerse AI" },
      { name: "description", content: "Movies you've saved to watch later, stored privately on your device." },
      { property: "og:title", content: "My Watchlist — CineVerse AI" },
      { property: "og:url", content: "/watchlist" },
    ],
    links: [{ rel: "canonical", href: "/watchlist" }],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const watchlist = useUserStore((s) => s.watchlist);
  const likes = useUserStore((s) => s.likes);
  const movies = watchlist.map((id) => MOVIES_BY_ID.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof MOVIES_BY_ID.get>>[];
  const favs = likes.map((id) => MOVIES_BY_ID.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof MOVIES_BY_ID.get>>[];

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Your Watchlist</h1>
      <p className="mt-2 text-sm text-muted-foreground">Saved on this device. Sign-in sync coming soon.</p>

      {movies.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-display text-2xl">Empty for now</p>
          <p className="mt-1 text-sm text-muted-foreground">Browse the catalog and tap + on any movie.</p>
          <Link to="/" className="mt-5 inline-block rounded-md brand-gradient px-4 py-2 text-sm font-semibold text-white">Browse movies</Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {movies.map((m, i) => <MovieCard key={m.id} movie={m} index={i} className="w-full" />)}
        </div>
      )}

      {favs.length > 0 && (
        <>
          <h2 className="mt-14 font-display text-3xl tracking-tight">Favorites</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {favs.map((m, i) => <MovieCard key={m.id} movie={m} index={i} className="w-full" />)}
          </div>
        </>
      )}
    </div>
  );
}
