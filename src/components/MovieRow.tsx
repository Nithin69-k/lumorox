import { useId, useRef } from "react";
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
  const ref = useRef<HTMLUListElement>(null);
  const uid = useId();
  const headingId = `row-heading-${uid}`;
  const listId = `row-list-${uid}`;
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.9, 900), behavior: "smooth" });
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scroll(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scroll(-1);
    }
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
    <section className="relative py-6 sm:py-7" aria-labelledby={headingId}>
      <div className="container mx-auto flex items-end justify-between gap-4 px-4">
        <div className="min-w-0">
          <h2 id={headingId} className="text-gradient font-display text-xl tracking-wide sm:text-2xl md:text-3xl">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          <div className="accent-rule mt-2" />
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            aria-controls={listId}
            onClick={() => scroll(-1)}
            className="grid h-11 w-11 place-items-center rounded-full glass text-foreground transition hover:scale-110 hover:bg-brand hover:text-brand-foreground hover:shadow-[var(--shadow-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ChevronLeft aria-hidden className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            aria-controls={listId}
            onClick={() => scroll(1)}
            className="grid h-11 w-11 place-items-center rounded-full glass text-foreground transition hover:scale-110 hover:bg-brand hover:text-brand-foreground hover:shadow-[var(--shadow-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ChevronRight aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>
      <ul
        id={listId}
        ref={ref}
        aria-label={title}
        onKeyDown={onKeyDown}
        className="scroll-row edge-fade mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 pt-1 sm:gap-4 sm:px-[max(1rem,calc((100vw-1280px)/2+1rem))]"
      >
        {movies.map((m, i) => (
          <li key={m.id} className="snap-start">
            <MovieCard movie={m} index={i} {...(ranked ? { rank: i + 1 } : {})} />
          </li>
        ))}
      </ul>
    </section>
  );
}

