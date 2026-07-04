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
}

export function MovieCard({ movie, index = 0, className, reason }: Props) {

  const inWatchlist = useUserStore((s) => s.watchlist.includes(movie.id));
  const toggle = useUserStore((s) => s.toggleWatchlist);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.03 }}
      className={cn("group relative w-[180px] shrink-0 sm:w-[200px]", className)}
    >
      <Link
        to="/movie/$id"
        params={{ id: movie.id }}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg shadow-[var(--shadow-card)] transition-transform duration-300 group-hover:scale-[1.04] group-hover:shadow-[var(--shadow-glow)]">
          <MoviePoster movie={movie} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-[var(--gold)] backdrop-blur">
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
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition hover:bg-brand group-hover:opacity-100 focus-visible:opacity-100"
          >
            {inWatchlist ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-2 px-0.5">
          <h3 className="line-clamp-1 text-sm font-medium text-foreground">{movie.title}</h3>
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
