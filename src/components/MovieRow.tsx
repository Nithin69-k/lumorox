import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Movie } from "@/data/movies";
import { MovieCard } from "./MovieCard";

interface Props {
  title: string;
  movies: Movie[];
  emptyHint?: string;
}

export function MovieRow({ title, movies, emptyHint }: Props) {
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
    <section className="relative py-6">
      <div className="container mx-auto flex items-end justify-between px-4">
        <h2 className="font-display text-2xl tracking-wide sm:text-3xl">{title}</h2>
        <div className="hidden gap-2 sm:flex">
          <button
            aria-label={`Scroll ${title} left`}
            onClick={() => scroll(-1)}
            className="grid h-9 w-9 place-items-center rounded-full glass text-foreground transition hover:bg-brand hover:text-brand-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label={`Scroll ${title} right`}
            onClick={() => scroll(1)}
            className="grid h-9 w-9 place-items-center rounded-full glass text-foreground transition hover:bg-brand hover:text-brand-foreground"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="scroll-row mt-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:px-[max(1rem,calc((100vw-1280px)/2+1rem))]"
      >
        {movies.map((m, i) => (
          <MovieCard key={m.id} movie={m} index={i} />
        ))}
      </div>
    </section>
  );
}
