import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Suspense } from "react";
import { MovieRow } from "@/components/MovieRow";
import { MovieRowSkeleton } from "@/components/MovieCardSkeleton";
import { Hero } from "@/components/Hero";
import { GENRES, genreSlug } from "@/data/genres";
import { motion } from "framer-motion";
import {
  getTrending, getPopular, getTopRated, getUpcoming, getByGenre,
  getNowPlaying, getLatestReleases,
  getTopTenToday, getBestThisMonth, getAllTimeBest, getByLanguage,
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
const topTenOpts = queryOptions({ queryKey: ["tmdb", "topTenToday"], queryFn: () => getTopTenToday(), ...live });
const bestMonthOpts = queryOptions({ queryKey: ["tmdb", "bestMonth"], queryFn: () => getBestThisMonth(), ...live });
const allTimeOpts = queryOptions({ queryKey: ["tmdb", "allTimeBest"], queryFn: () => getAllTimeBest(), ...live });
const langOpts = (lang: string, window?: "recent" | "all") =>
  queryOptions({
    queryKey: ["tmdb", "lang", lang, window ?? "all"],
    queryFn: () => getByLanguage({ data: { lang, ...(window ? { window } : {}) } }),
    ...live,
  });
const genreOpts = (g: string) => queryOptions({ queryKey: ["tmdb", "genre", g], queryFn: () => getByGenre({ data: { genre: g } }), ...live });

// Worldwide language rows shown on the home page
const LANGUAGE_ROWS: Array<{ lang: string; title: string }> = [
  { lang: "te", title: "Telugu Cinema" },
  { lang: "ta", title: "Tamil Cinema" },
  { lang: "kn", title: "Kannada Cinema" },
  { lang: "ml", title: "Malayalam Cinema" },
  { lang: "hi", title: "Hindi / Bollywood" },
  { lang: "ja", title: "Japanese Cinema" },
  { lang: "ko", title: "Korean Cinema" },
  { lang: "zh", title: "Chinese Cinema" },
  { lang: "es", title: "Spanish Cinema" },
  { lang: "fr", title: "French Cinema" },
];


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LumoroX AI — Discover Your Next Favorite Movie" },
      { name: "description", content: "Trending, top rated, and personalized movie recommendations powered by TMDB." },
      { property: "og:title", content: "LumoroX AI — Discover Your Next Favorite Movie" },
      { property: "og:description", content: "Trending, top rated, and personalized movie recommendations." },
      { property: "og:url", content: "https://lumorox.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://lumorox.lovable.app/" }],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(trendingOpts);
    context.queryClient.prefetchQuery(nowPlayingOpts);
    context.queryClient.prefetchQuery(latestOpts);
    context.queryClient.prefetchQuery(popularOpts);
    context.queryClient.prefetchQuery(topRatedOpts);
    context.queryClient.prefetchQuery(upcomingOpts);
    context.queryClient.prefetchQuery(topTenOpts);
    context.queryClient.prefetchQuery(bestMonthOpts);
  },
  component: HomePage,
});

function HomePage() {
  const { data: trendingList } = useSuspenseQuery(trendingOpts);
  const hero = trendingList[0];

  return (
    <>
      <h1 className="sr-only">
        LumoroX AI — worldwide movie reviews, ratings, trailers, synopses and AI recommendations
      </h1>
      {hero && <Hero movie={hero} />}


      <div className="aurora space-y-2 pb-10">
        <Suspense fallback={<MovieRowSkeleton title="Top 10 Today" />}><TopTenRow /></Suspense>
        <MovieRow title="Trending This Week" subtitle="What the world is watching right now" movies={trendingList} />
        <Suspense fallback={<MovieRowSkeleton title="In Cinemas Now" />}><NowPlayingRow /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="New Movies" />}><LatestRow /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Best This Month" />}><BestMonthRow /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Popular Right Now" />}><PopularRow /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Top Rated" />}><TopRatedRow /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Best Movies of All Time" />}><AllTimeRow /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Coming Soon" />}><UpcomingRow /></Suspense>

        {LANGUAGE_ROWS.map((l) => (
          <Suspense key={l.lang} fallback={<MovieRowSkeleton title={l.title} />}>
            <LanguageRow lang={l.lang} title={l.title} />
          </Suspense>
        ))}

        <Suspense fallback={<MovieRowSkeleton title="Action & Adventure" />}><GenreRow genre="Action" title="Action & Adventure" /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Mind-Bending Sci-Fi" />}><GenreRow genre="Science Fiction" title="Mind-Bending Sci-Fi" /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Drama Spotlight" />}><GenreRow genre="Drama" title="Drama Spotlight" /></Suspense>
        <Suspense fallback={<MovieRowSkeleton title="Animation Picks" />}><GenreRow genre="Animation" title="Animation Picks" /></Suspense>



        <section className="container mx-auto px-4 py-12">
          <h2 className="text-gradient font-display text-3xl tracking-wide">Browse by Genre</h2>
          <div className="accent-rule mt-2" />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {GENRES.map((g, i) => (
              <motion.div
                key={g}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: (i % 8) * 0.03 }}
              >
                <Link
                  to="/search"
                  search={{ q: "", genre: g, year: "", min: 0, sort: "popularity" }}
                  className="group relative flex h-28 items-end overflow-hidden rounded-2xl border border-white/10 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-brand/50 hover:shadow-[var(--shadow-glow)]"
                  style={{
                    background: `linear-gradient(135deg, hsl(${(i * 37) % 360} 65% 26%), hsl(${(i * 37 + 60) % 360} 55% 10%))`,
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-4 -top-6 font-display text-7xl leading-none text-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:text-white/20"
                  >
                    {g.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  <span className="relative font-display text-xl tracking-wide text-white transition-transform duration-300 group-hover:translate-x-1">
                    {g}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

      </div>
    </>
  );
}

function NowPlayingRow() {
  const { data } = useSuspenseQuery(nowPlayingOpts);
  return <MovieRow title="In Cinemas Now" movies={data} />;
}
function LatestRow() {
  const { data } = useSuspenseQuery(latestOpts);
  return <MovieRow title="New Movies" movies={data} />;
}
function PopularRow() {
  const { data } = useSuspenseQuery(popularOpts);
  return <MovieRow title="Popular Right Now" movies={data} />;
}
function TopTenRow() {
  const { data } = useSuspenseQuery(topTenOpts);
  return <MovieRow title="Top 10 Today" subtitle="Ranked by global viewers today" movies={data} ranked />;
}
function BestMonthRow() {
  const { data } = useSuspenseQuery(bestMonthOpts);
  return <MovieRow title="Best This Month" movies={data} />;
}
function AllTimeRow() {
  const { data } = useSuspenseQuery(allTimeOpts);
  return <MovieRow title="Best Movies of All Time" movies={data} />;
}
function LanguageRow({ lang, title }: { lang: string; title: string }) {
  const { data } = useSuspenseQuery(langOpts(lang));
  return <MovieRow title={title} movies={data} />;
}

function TopRatedRow() {
  const { data } = useSuspenseQuery(topRatedOpts);
  return <MovieRow title="Top Rated" movies={data} />;
}
function UpcomingRow() {
  const { data } = useSuspenseQuery(upcomingOpts);
  return <MovieRow title="Coming Soon" movies={data} />;
}
function GenreRow({ genre, title }: { genre: string; title?: string }) {
  const { data } = useSuspenseQuery(genreOpts(genre));
  return <MovieRow title={title ?? genre} movies={data} />;
}
