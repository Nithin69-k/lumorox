import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Movie } from "@/data/movies";

interface Props {
  movie: Pick<Movie, "title" | "posterHue" | "posterUrl" | "year">;
  className?: string;
  rounded?: string;
}

/** Cinematic generated poster — used when no remote poster URL is available. */
export function MoviePoster({ movie, className, rounded = "rounded-lg" }: Props) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [movie.posterUrl]);

  if (movie.posterUrl && !imageFailed) {
    return (
      <img
        src={movie.posterUrl}
        alt={`${movie.title} poster`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className={cn("h-full w-full object-cover", rounded, className)}
      />
    );
  }
  const h = movie.posterHue ?? 0;
  const style = {
    background: `radial-gradient(120% 80% at 30% 10%, hsl(${h} 70% 35%) 0%, hsl(${(h + 30) % 360} 60% 15%) 55%, hsl(${(h + 60) % 360} 50% 8%) 100%)`,
  };
  return (
    <div
      role="img"
      aria-label={`${movie.title} poster`}
      style={style}
      className={cn(
        "relative flex h-full w-full flex-col justify-end overflow-hidden p-4 text-left",
        rounded,
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(transparent_60%,rgba(0,0,0,0.6))]" />
      <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay [background-image:repeating-linear-gradient(45deg,#fff_0_1px,transparent_1px_6px)]" />
      <div className="relative z-10">
        <p className="font-display text-2xl leading-none tracking-wide text-white drop-shadow-lg sm:text-3xl">
          {movie.title}
        </p>
        <p className="mt-1 text-xs text-white/70">{movie.year}</p>
      </div>
    </div>
  );
}
