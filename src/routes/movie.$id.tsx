import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Star, Clock, Calendar, ArrowLeft, Heart, ThumbsUp, ThumbsDown, Play } from "lucide-react";
import { motion } from "framer-motion";
import { MoviePoster } from "@/components/MoviePoster";
import { MovieRow } from "@/components/MovieRow";
import { useUserStore } from "@/store/user";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getMovieDetails, getSimilar, getMovieCredits, type CreditPerson } from "@/lib/tmdb.functions";
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

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlaying(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
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
          className="absolute left-4 top-24 inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-sm text-foreground hover:bg-accent md:top-20"
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
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:bg-foreground/90"
              >
                <Play className="h-4 w-4 fill-current" /> Play trailer
              </button>
            )}
            <button
              onClick={() => toggleWatchlist(movie.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition",
                inList ? "border-brand bg-brand text-brand-foreground" : "border-border hover:border-brand hover:text-brand",
              )}
            >
              <Heart className={cn("h-4 w-4", inList && "fill-current")} /> {inList ? "In watchlist" : "Add to watchlist"}
            </button>
            <button
              onClick={() => toggleLike(movie.id)}
              aria-label="Like"
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm transition",
                liked ? "border-green-500/60 text-green-400" : "border-border hover:border-foreground",
              )}
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => toggleDislike(movie.id)}
              aria-label="Dislike"
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm transition",
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
                  aria-label={`Rate ${n}/10`}
                  className={cn(
                    "h-8 w-7 rounded-md text-xs font-semibold transition",
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
          className="fixed inset-0 z-[60] grid place-items-center bg-black/85 p-4 backdrop-blur"
          onClick={() => setPlaying(false)}
          role="dialog"
          aria-label="Trailer"
        >
          <div className="aspect-video w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={`https://www.youtube.com/embed/${movie.trailerYoutubeId}?autoplay=1`}
              title={`${movie.title} trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full rounded-lg"
            />
          </div>
        </div>
      )}

      <div className="mt-16">
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
