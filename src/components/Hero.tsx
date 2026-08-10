import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Play, Plus, Info, Star } from "lucide-react";
import type { Movie } from "@/data/movies";
import { MoviePoster } from "./MoviePoster";
import { useUserStore } from "@/store/user";

export function Hero({ movie }: { movie: Movie }) {
  const toggleWatchlist = useUserStore((s) => s.toggleWatchlist);
  const inWatchlist = useUserStore((s) => s.watchlist.includes(movie.id));

  return (
    <section className="relative h-[88vh] min-h-[600px] w-full overflow-hidden">
      <div className="absolute inset-0 scale-110">
        <MoviePoster movie={movie} rounded="" className="brightness-[0.45] blur-[2px]" />
      </div>
      <div className="absolute inset-0 [background:var(--gradient-hero)]" />

      <div className="container relative z-10 mx-auto grid h-full grid-cols-1 items-end gap-8 px-4 pb-20 pt-32 md:grid-cols-[1fr_320px] md:items-center md:pb-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Featured tonight
          </span>
          <h2 className="mt-4 font-display text-5xl leading-none tracking-tight text-foreground sm:text-7xl md:text-[5.5rem]">
            {movie.title}
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 text-[var(--gold)]">
              <Star className="h-4 w-4 fill-current" /> {movie.rating.toFixed(1)}
            </span>
            <span>{movie.year}</span>
            <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{movie.genres.slice(0, 3).join(" · ")}</span>
          </div>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground/85 sm:text-lg">
            {movie.overview}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/movie/$id"
              params={{ id: movie.id }}
              search={{ play: true }}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:bg-foreground/90"
            >
              <Play className="h-4 w-4 fill-current" /> Watch trailer
            </Link>

            <Link
              to="/movie/$id"
              params={{ id: movie.id }}
              search={{}}
              className="inline-flex items-center gap-2 rounded-md glass px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              <Info className="h-4 w-4" /> More info
            </Link>
            <button
              type="button"
              onClick={() => toggleWatchlist(movie.id)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
            >
              <Plus className="h-4 w-4" /> {inWatchlist ? "In watchlist" : "Watchlist"}
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="hidden aspect-[2/3] w-full max-w-[320px] overflow-hidden rounded-xl shadow-[var(--shadow-card)] md:block"
        >
          <MoviePoster movie={movie} rounded="rounded-xl" />
        </motion.div>
      </div>
    </section>
  );
}
