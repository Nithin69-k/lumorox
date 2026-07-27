import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Suspense } from "react";
import { MovieRow } from "@/components/MovieRow";
import { MovieRowSkeleton } from "@/components/MovieCardSkeleton";
import { Hero } from "@/components/Hero";
import { GENRES } from "@/data/genres";
import { motion } from "framer-motion";
import {
  getTrending, getPopular, getTopRated, getUpcoming, getByGenre,
  getNowPlaying, getLatestReleases,
} from "@/lib/tmdb.functions";

// Auto-refresh cadence for catalogue data (15 minutes)
const REFRESH_MS = 15 * 60_000;
const live = { staleTime: REFRESH_MS, refetchInterval: REFRESH_MS, refetchOnWindowFocus: true } as const;

const trendingOpts = queryOptions({ queryKey: ["tmdb", "trending"], queryFn: () => getTrending(), ...live });
const nowPlayingOpts = queryOptions({ queryKey: ["tmdb", "nowPlaying"], queryFn: () => getNowPlaying(), ...live });
const latestOpts = queryOptions({ queryKey: ["tmdb", "latest"], queryFn: () => getLatestReleases(), ...live });
const popularOpts = queryOptions({ queryKey: ["tmdb", "popular"], queryFn: () => getPopular(), ...live });
const topRatedOpts = queryOptions({ queryKey: ["tmdb", "topRated"], queryFn: () => getTopRated(), ...live });
const upcomingOpts = queryOptions({ queryKey: ["tmdb", "upcoming"], queryFn: () => getUpcoming(), ...live });
const genreOpts = (g: string) => queryOptions({ queryKey: ["tmdb", "genre", g], queryFn: () => getByGenre({ data: { genre: g } }), ...live });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LumoroX AI — Discover Your Next Favorite Movie" },
      { name: "description", content: "Trending, top rated, and personalized movie recommendations powered by TMDB." },
      { property: "og:title", content: "LumoroX AI — Discover Your Next Favorite Movie" },
      { property: "og:description", content: "Trending, top rated, and personalized movie recommendations." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(trendingOpts);
    context.queryClient.prefetchQuery(nowPlayingOpts);
    context.queryClient.prefetchQuery(latestOpts);
    context.queryClient.prefetchQuery(popularOpts);
    context.queryClient.prefetchQuery(topRatedOpts);
    context.queryClient.prefetchQuery(upcomingOpts);
  },
  component: HomePage,
});

function HomePage() {
  const { data: trendingList } = useSuspenseQuery(trendingOpts);
  const hero = trendingList[0];

  return (
    <>
      {hero && <Hero movie={hero} />}

      <div className="space-y-2 pb-10">
        <MovieRow title="Trending Now" movies={trendingList} />
        <Suspense fallback={<MovieRowSkeleton title="In Cinemas Now" />}><NowPlayingRow /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Just Released" />}><LatestRow /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Popular This Week" />}><PopularRow /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Top Rated" />}><TopRatedRow /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Coming Soon" />}><UpcomingRow /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Action & Adventure" />}><GenreRow genre="Action" title="Action & Adventure" /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Mind-Bending Sci-Fi" />}><GenreRow genre="Science Fiction" title="Mind-Bending Sci-Fi" /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Drama Spotlight" />}><GenreRow genre="Drama" title="Drama Spotlight" /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Animation Picks" />}><GenreRow genre="Animation" title="Animation Picks" /></Suspense>


        <section className="container mx-auto px-4 py-10">
          <h2 className="font-display text-3xl tracking-wide">Browse by Genre</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {GENRES.map((g, i) => (
              <motion.div
                key={g}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.02 }}
              >
                <Link
                  to="/search"
                  search={{ q: "", genre: g, year: "", min: 0, sort: "popularity" }}
                  className="group flex h-24 items-end overflow-hidden rounded-xl p-4 transition hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]"
                  style={{
                    background: `linear-gradient(135deg, hsl(${(i * 37) % 360} 60% 25%), hsl(${(i * 37 + 60) % 360} 50% 12%))`,
                  }}
                >
                  <span className="font-display text-xl tracking-wide text-white">{g}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function PopularRow() {
  const { data } = useSuspenseQuery(popularOpts);
  return <MovieRow title="Popular This Week" movies={data} />;
}
function TopRatedRow() {
  const { data } = useSuspenseQuery(topRatedOpts);
  return <MovieRow title="Top Rated" movies={data} />;
}
function UpcomingRow() {
  const { data } = useSuspenseQuery(upcomingOpts);
  return <MovieRow title="Recent & Upcoming" movies={data} />;
}
function GenreRow({ genre, title }: { genre: string; title?: string }) {
  const { data } = useSuspenseQuery(genreOpts(genre));
  return <MovieRow title={title ?? genre} movies={data} />;
}
