import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Star, Clock, Calendar, ArrowLeft, Heart, ThumbsUp, ThumbsDown, Play, X } from "lucide-react";
import { motion } from "framer-motion";
import { MoviePoster } from "@/components/MoviePoster";
import { MovieRow } from "@/components/MovieRow";
import { useUserStore } from "@/store/user";
import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getMovieDetails, getSimilar, getMovieCredits, getByGenre, type CreditPerson } from "@/lib/tmdb.functions";
import type { Movie } from "@/data/movies";
import { getSemanticSimilar } from "@/lib/semantic.functions";

const detailsOpts = (id: string) => queryOptions({
  queryKey: ["tmdb", "movie", id],
  queryFn: () => getMovieDetails({ data: { id } }),
  staleTime: 30 * 60_000,
});
const similarOpts = (id: string) => queryOptions({
  queryKey: ["tmdb", "similar", id],
  queryFn: () => getSimilar({ data: { id } }),
  staleTime: 30 * 60_000,
});

export const Route = createFileRoute("/movie/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    play:
      search.play === true || search.play === "1" || search.play === "true"
        ? true
        : undefined,
  }),
  loader: async ({ params, context }) => {

    const movie = await context.queryClient.ensureQueryData(detailsOpts(params.id));
    if (!movie) throw notFound();
    context.queryClient.prefetchQuery(similarOpts(params.id));
    return {
      title: movie.title,
      year: movie.year,
      overview: movie.overview,
      posterUrl: movie.posterUrl,
      rating: movie.rating,
      runtime: movie.runtime,
      genres: movie.genres,
      director: movie.director,
      cast: movie.cast,
      trailerYoutubeId: movie.trailerYoutubeId,
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Movie — LumoroX AI" }] };
    const url = `https://lumorox.lovable.app/movie/${params.id}`;
    const d = loaderData;
    const title = `${d.title} (${d.year}) — Review, Trailer & Synopsis | LumoroX AI`;
    const description =
      `${d.title} (${d.year}): ${d.overview}`.slice(0, 155).trim() + "…";
    const movieSchema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Movie",
      name: d.title,
      url,
      description: d.overview,
      dateCreated: String(d.year),
      genre: d.genres,
      ...(d.posterUrl ? { image: d.posterUrl } : {}),
      ...(d.runtime ? { duration: `PT${d.runtime}M` } : {}),
      ...(d.director ? { director: { "@type": "Person", name: d.director } } : {}),
      ...(d.cast?.length
        ? { actor: d.cast.slice(0, 6).map((name: string) => ({ "@type": "Person", name })) }
        : {}),
      ...(d.rating
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: Number(d.rating.toFixed(1)),
              bestRating: 10,
              worstRating: 0,
              ratingCount: 1,
            },
          }
        : {}),
      ...(d.trailerYoutubeId
        ? {
            trailer: {
              "@type": "VideoObject",
              name: `${d.title} — Official Trailer`,
              embedUrl: `https://www.youtube.com/embed/${d.trailerYoutubeId}`,
              thumbnailUrl: `https://img.youtube.com/vi/${d.trailerYoutubeId}/hqdefault.jpg`,
              description: d.overview.slice(0, 200),
              uploadDate: `${d.year}-01-01`,
            },
          }
        : {}),
    };
    const breadcrumbs = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://lumorox.lovable.app/" },
        { "@type": "ListItem", position: 2, name: "Movies", item: "https://lumorox.lovable.app/search" },
        { "@type": "ListItem", position: 3, name: d.title, item: url },
      ],
    };
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: `${d.title} (${d.year}) — Trailer, Review & Synopsis` },
        { property: "og:description", content: d.overview.slice(0, 200) },
        { property: "og:type", content: "video.movie" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${d.title} (${d.year})` },
        { name: "twitter:description", content: d.overview.slice(0, 200) },
        ...(d.posterUrl
          ? [
              { property: "og:image" as const, content: d.posterUrl },
              { name: "twitter:image" as const, content: d.posterUrl },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(movieSchema) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbs) },
      ],
    };
  },

  component: MoviePage,
  notFoundComponent: () => (
    <div className="container mx-auto px-4 py-20 text-center">
      <h1 className="font-display text-4xl">Movie not found</h1>
      <Link to="/" className="mt-4 inline-block text-brand hover:underline">← Back home</Link>
    </div>
  ),
});

function MoviePage() {
  const { id } = Route.useParams();
  const { data: movie } = useSuspenseQuery(detailsOpts(id));
  const { data: similar = [] } = useSuspenseQuery(similarOpts(id));
  const { data: semantic = [] } = useQuery({
    queryKey: ["semantic", "similar", id],
    queryFn: () => getSemanticSimilar({ data: { id, limit: 12 } }),
    staleTime: 60 * 60_000,
  });
  const { data: credits } = useQuery({
    queryKey: ["tmdb", "credits", id],
    queryFn: () => getMovieCredits({ data: { id } }),
    staleTime: 6 * 60 * 60_000,
  });
  const { play } = Route.useSearch();
  const [playing, setPlaying] = useState(Boolean(play));
  const liked = useUserStore((s) => s.likes.includes(id));
  const disliked = useUserStore((s) => s.dislikes.includes(id));
  const inList = useUserStore((s) => s.watchlist.includes(id));
  const userRating = useUserStore((s) => s.ratings[id]);
  const toggleLike = useUserStore((s) => s.toggleLike);
  const toggleDislike = useUserStore((s) => s.toggleDislike);
  const toggleWatchlist = useUserStore((s) => s.toggleWatchlist);
  const rate = useUserStore((s) => s.rate);

  // Focus management for the trailer dialog: trap Tab inside it while open and
  // return focus to the trigger when it closes, so keyboard users never get lost.
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeTrailer = () => setPlaying(false);

  useEffect(() => {
    if (!playing) {
      const t = triggerRef.current;
      triggerRef.current = null;
      t?.focus();
      return;
    }
    triggerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], iframe, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute("disabled"));

    const raf = requestAnimationFrame(() => focusables()[0]?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPlaying(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [playing]);



  if (!movie) return null;

  return (
    <article className="-mt-28 md:-mt-16">
      <div className="relative h-[70vh] min-h-[480px] w-full overflow-hidden">
        <MoviePoster
          movie={{ ...movie, posterUrl: movie.backdropUrl ?? movie.posterUrl }}
          rounded=""
          className="scale-110 brightness-[0.4] blur-sm"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/40" />
        <Link
          to="/"
          className="absolute left-4 top-24 inline-flex min-h-11 items-center gap-2 rounded-full glass px-3 py-1.5 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:top-20"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      <div className="container relative mx-auto -mt-72 grid grid-cols-1 gap-8 px-4 md:grid-cols-[260px_1fr] md:gap-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto aspect-[2/3] w-56 overflow-hidden rounded-xl shadow-[var(--shadow-card)] md:w-full"
        >
          <MoviePoster movie={movie} rounded="rounded-xl" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h1 className="font-display text-4xl leading-none tracking-tight sm:text-6xl">{movie.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 text-[var(--gold)]">
              <Star className="h-4 w-4 fill-current" /> {movie.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {movie.year}</span>
            {movie.runtime > 0 && (
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {movie.genres.map((g: string) => (
              <span key={g} className="rounded-full border border-border px-3 py-0.5 text-xs text-muted-foreground">{g}</span>
            ))}
          </div>

          <p className="mt-5 max-w-3xl text-base leading-relaxed text-foreground/90">{movie.overview}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            {movie.trailerYoutubeId && (
              <button
                onClick={() => setPlaying(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Play className="h-4 w-4 fill-current" /> Play trailer
              </button>
            )}
            <button
              onClick={() => toggleWatchlist(movie.id)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                inList ? "border-brand bg-brand text-brand-foreground" : "border-border hover:border-brand hover:text-brand",
              )}
            >
              <Heart className={cn("h-4 w-4", inList && "fill-current")} /> {inList ? "In watchlist" : "Add to watchlist"}
            </button>
            <button
              onClick={() => toggleLike(movie.id)}
              aria-label={liked ? "Remove like" : "Like this movie"} aria-pressed={liked}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                liked ? "border-green-500/60 text-green-400" : "border-border hover:border-foreground",
              )}
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => toggleDislike(movie.id)}
              aria-label={disliked ? "Remove dislike" : "Dislike this movie"} aria-pressed={disliked}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                disliked ? "border-destructive/60 text-destructive" : "border-border hover:border-foreground",
              )}
            >
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your rating</p>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => rate(movie.id, n)}
                  aria-label={`Rate ${n} out of 10`} aria-pressed={(userRating ?? 0) === n}
                  className={cn(
                    "h-11 w-8 rounded-md text-xs font-semibold transition sm:h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    (userRating ?? 0) >= n ? "bg-brand text-brand-foreground" : "bg-secondary text-muted-foreground hover:bg-accent",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {movie.director && (
              <div>
                <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Director</h2>
                <p className="mt-1 text-foreground">{movie.director}</p>
              </div>
            )}
            {movie.cast.length > 0 && (
              <div>
                <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Cast</h2>
                <p className="mt-1 text-foreground">{movie.cast.join(", ")}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {playing && movie.trailerYoutubeId && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/85 p-4 backdrop-blur"
          onClick={closeTrailer}
          role="dialog"
          aria-modal="true"
          aria-label={`${movie.title} trailer`}
        >
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={closeTrailer}
                className="inline-flex min-h-11 items-center gap-2 rounded-full glass px-4 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <X aria-hidden className="h-4 w-4" /> Close trailer
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${movie.trailerYoutubeId}?autoplay=1`}
                title={`${movie.title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {(credits?.cast?.length || credits?.crew?.length) ? (
        <div className="container mx-auto mt-16 px-4">
          <PeopleSection title="Top Cast" people={credits?.cast ?? []} />
          <PeopleSection title="Crew" people={credits?.crew ?? []} />
        </div>
      ) : null}

      <div className="mt-16">
        <BecauseYouWatched movie={movie} pool={[...similar, ...semantic.map((s) => s.movie)]} />
        {semantic.length > 0 && (
          <MovieRow
            title="Semantically Similar (AI)"
            movies={semantic.map((s) => s.movie)}
          />
        )}
        <MovieRow title="More Like This" movies={similar} emptyHint="No similar titles yet." />
      </div>

    </article>
  );
}

/**
 * Personalized "Because you watched …" row: blends this title's genre context
 * with the viewer's watchlist, likes and ratings to re-rank a candidate pool.
 */
function BecauseYouWatched({ movie, pool }: { movie: Movie; pool: Movie[] }) {
  const watchlist = useUserStore((s) => s.watchlist);
  const likes = useUserStore((s) => s.likes);
  const dislikes = useUserStore((s) => s.dislikes);
  const ratings = useUserStore((s) => s.ratings);

  const primary = movie.genres[0];
  const secondary = movie.genres[1];
  const { data: g1 = [] } = useQuery({
    queryKey: ["tmdb", "genre", primary],
    queryFn: () => getByGenre({ data: { genre: primary as string } }),
    enabled: Boolean(primary),
    staleTime: 30 * 60_000,
  });
  const { data: g2 = [] } = useQuery({
    queryKey: ["tmdb", "genre", secondary],
    queryFn: () => getByGenre({ data: { genre: secondary as string } }),
    enabled: Boolean(secondary),
    staleTime: 30 * 60_000,
  });

  const picks = useMemo(() => {
    // Genres the viewer keeps saving / liking / rating highly.
    const affinity = new Map<string, number>();
    const seedIds = new Set<string>([
      ...watchlist,
      ...likes,
      ...Object.entries(ratings).filter(([, r]) => r >= 7).map(([id]) => id),
    ]);
    const candidates = [...pool, ...g1, ...g2];
    for (const c of candidates) {
      if (!seedIds.has(c.id)) continue;
      for (const g of c.genres) affinity.set(g, (affinity.get(g) ?? 0) + 1);
    }
    for (const g of movie.genres) affinity.set(g, (affinity.get(g) ?? 0) + 1.5);

    const blocked = new Set<string>([movie.id, ...dislikes]);
    const seen = new Set<string>();
    const scored = candidates
      .filter((c) => {
        if (blocked.has(c.id) || seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      })
      .map((c) => {
        const genreScore = c.genres.reduce((sum: number, g: string) => sum + (affinity.get(g) ?? 0), 0);
        const shared = c.genres.filter((g: string) => (movie.genres as string[]).includes(g)).length;
        const inPool = pool.some((p) => p.id === c.id) ? 1.2 : 0;
        const saved = watchlist.includes(c.id) ? -2 : 0; // already saved -> deprioritise
        return { c, score: genreScore * 0.6 + shared * 1.4 + c.rating * 0.25 + inPool + saved };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 18)
      .map((x) => x.c);
    return scored;
  }, [pool, g1, g2, movie, watchlist, likes, dislikes, ratings]);

  if (picks.length === 0) return null;

  const personalized = watchlist.length + likes.length + Object.keys(ratings).length > 0;

  return (
    <>
      <JsonLd data={itemListSchema(`Recommended because you watched ${movie.title}`, picks)} />
      <MovieRow
        title={`Because you watched ${movie.title}`}
        subtitle={
          personalized
            ? "Matched to this title's genres and your watchlist, likes and ratings"
            : `Picked from ${movie.genres.slice(0, 2).join(" & ") || "similar"} titles you may enjoy next`
        }
        movies={picks}
      />
    </>
  );
}

function PeopleSection({ title, people }: { title: string; people: CreditPerson[] }) {

  if (people.length === 0) return null;
  return (
    <section className="mt-10 first:mt-0" aria-label={title}>
      <h2 className="text-gradient font-display text-2xl tracking-wide sm:text-3xl">{title}</h2>
      <div className="accent-rule mt-2" />
      <ul className="mt-5 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {people.map((p) => (
          <li key={p.id} className="min-w-0">
            <div className="aspect-[2/3] overflow-hidden rounded-xl bg-secondary ring-1 ring-white/5">
              {p.profileUrl ? (
                <img
                  src={p.profileUrl}
                  alt={`${p.name}, ${p.role}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div aria-hidden className="grid h-full w-full place-items-center font-display text-2xl text-muted-foreground">
                  {p.name.slice(0, 1)}
                </div>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-foreground">{p.name}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{p.role}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

