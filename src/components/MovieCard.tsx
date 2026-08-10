import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Star, Plus, Check } from "lucide-react";
import type { Movie } from "@/data/movies";
import { MoviePoster } from "./MoviePoster";
import { useUserStore } from "@/store/user";
import { cn } from "@/lib/utils";

interface Props {
  movie: Movie;
  index?: number;
  className?: string;
  reason?: string;
  /** When set, renders a large outlined rank numeral (Top 10 style). */
  rank?: number;
}

export function MovieCard({ movie, index = 0, className, reason, rank }: Props) {

  const inWatchlist = useUserStore((s) => s.watchlist.includes(movie.id));
  const toggle = useUserStore((s) => s.toggleWatchlist);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.03 }}
      whileHover={{ y: -6 }}
      className={cn(
        "group relative w-[180px] shrink-0 sm:w-[200px]",
        rank ? "pl-7 sm:pl-9" : "",
        className,
      )}
    >
      {rank && (
        <span
          aria-hidden
          className="rank-numeral pointer-events-none absolute -left-1 bottom-14 z-10 select-none text-[64px] sm:text-[76px]"
        >
          {rank}
        </span>
      )}
      <Link
        to="/movie/$id"
        params={{ id: movie.id }}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="sheen relative aspect-[2/3] overflow-hidden rounded-xl shadow-[var(--shadow-card)] ring-1 ring-white/5 transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-[var(--shadow-glow)] group-hover:ring-brand/50">
          <MoviePoster movie={movie} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/55 px-2 py-0.5 text-xs font-semibold text-[var(--gold)] backdrop-blur">
            <Star className="h-3 w-3 fill-current" />
            {movie.rating.toFixed(1)}
          </div>
          <button
            type="button"
            aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
            onClick={(e) => {
              e.preventDefault();
              toggle(movie.id);
            }}
            className="absolute right-2 top-2 grid h-8 w-8 translate-y-1 place-items-center rounded-full border border-white/10 bg-black/55 text-white opacity-0 backdrop-blur transition-all hover:bg-brand group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100"
          >
            {inWatchlist ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
          <div className="pointer-events-none absolute inset-x-2 bottom-2 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/90 px-2.5 py-1 text-[11px] font-semibold text-brand-foreground shadow-[var(--shadow-glow)]">
              <Play className="h-3 w-3 fill-current" /> Watch trailer
            </span>
          </div>
        </div>
        <div className="mt-2.5 px-0.5">
          <h3 className="line-clamp-1 text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-brand">
            {movie.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {movie.year} · {movie.genres.slice(0, 2).join(", ")}
          </p>
          {reason && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-brand/90">
              {reason}
            </p>
          )}
        </div>

      </Link>
    </motion.div>
  );
}

