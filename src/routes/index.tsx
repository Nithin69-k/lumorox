import { createFileRoute, Link } from "@tanstack/react-router";
import { MovieRow } from "@/components/MovieRow";
import { Hero } from "@/components/Hero";
import { trending, topRated, popular, upcoming, recommendFor, byGenre } from "@/lib/recommendation";
import { useUserStore } from "@/store/user";
import { GENRES } from "@/data/genres";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CineVerse AI — Discover Your Next Favorite Movie" },
      { name: "description", content: "Trending, top rated, and personalized movie recommendations powered by a hybrid AI engine." },
      { property: "og:title", content: "CineVerse AI — Discover Your Next Favorite Movie" },
      { property: "og:description", content: "Trending, top rated, and personalized movie recommendations." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  const signals = useUserStore((s) => ({ likes: s.likes, dislikes: s.dislikes, watchlist: s.watchlist, ratings: s.ratings }));
  const trendingList = trending();
  const hero = trendingList[0];
  const recs = recommendFor(signals, 18);
  const showPersonal = signals.likes.length + signals.watchlist.length + Object.keys(signals.ratings).length > 0;

  return (
    <>
      {hero && <Hero movie={hero} />}

      <div className="space-y-2 pb-10">
        <MovieRow title="Trending Now" movies={trendingList} />
        {showPersonal && <MovieRow title="Recommended For You" movies={recs} />}
        <MovieRow title="Popular This Week" movies={popular()} />
        <MovieRow title="Top Rated" movies={topRated()} />
        <MovieRow title="Recent & Upcoming" movies={upcoming()} />
        <MovieRow title="Action & Adventure" movies={byGenre("Action")} />
        <MovieRow title="Mind-Bending Sci-Fi" movies={byGenre("Science Fiction")} />
        <MovieRow title="Drama Spotlight" movies={byGenre("Drama")} />
        <MovieRow title="Animation Picks" movies={byGenre("Animation")} />

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
