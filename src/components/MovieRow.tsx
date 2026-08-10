import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Movie } from "@/data/movies";
import { MovieCard } from "./MovieCard";

interface Props {
  title: string;
  movies: Movie[];
  emptyHint?: string;
  /** Numbers the cards 1..n with big outlined numerals. */
  ranked?: boolean;
  /** Optional small line under the title. */
  subtitle?: string;
}

export function MovieRow({ title, movies, emptyHint, ranked, subtitle }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.9, 900), behavior: "smooth" });
  };

  if (movies.length === 0 && emptyHint) {
    return (
      <section className="container mx-auto px-4 py-6">
        <h2 className="font-display text-2xl tracking-wide sm:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{emptyHint}</p>
      </section>
    );
  }

  return (
    <section className="relative py-7">
      <div className="container mx-auto flex items-end justify-between gap-4 px-4">
        <div>
          <h2 className="text-gradient font-display text-2xl tracking-wide sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          <div className="accent-rule mt-2" />
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            aria-label={`Scroll ${title} left`}
            onClick={() => scroll(-1)}
            className="grid h-9 w-9 place-items-center rounded-full glass text-foreground transition hover:scale-110 hover:bg-brand hover:text-brand-foreground hover:shadow-[var(--shadow-glow)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label={`Scroll ${title} right`}
            onClick={() => scroll(1)}
            className="grid h-9 w-9 place-items-center rounded-full glass text-foreground transition hover:scale-110 hover:bg-brand hover:text-brand-foreground hover:shadow-[var(--shadow-glow)]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="scroll-row edge-fade mt-4 flex gap-4 overflow-x-auto px-4 pb-3 pt-1 sm:px-[max(1rem,calc((100vw-1280px)/2+1rem))]"
      >
        {movies.map((m, i) => (
          <MovieCard key={m.id} movie={m} index={i} {...(ranked ? { rank: i + 1 } : {})} />
        ))}
      </div>
    </section>
  );
}

