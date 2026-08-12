import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { MovieCardSkeleton } from "@/components/MovieCardSkeleton";
import { genreFromSlug } from "@/data/genres";
import { getGenrePage } from "@/lib/tmdb.functions";

export const Route = createFileRoute("/genre/$genre")({
  loader: ({ params }) => {
    const genre = genreFromSlug(params.genre);
    if (!genre) throw notFound();
    return { genre };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Genre not found — LumoroX AI" }, { name: "robots", content: "noindex" }] };
    }
    const g = loaderData.genre;
    const lg = g.toLowerCase();
    const url = `https://lumorox.lovable.app/genre/${params.genre}`;
    const title = `${g} Movies & TV Shows — New Releases First | LumoroX AI`;
    const description = `Watch every ${lg} movie, TV series and show ordered newest to oldest — ratings, reviews, synopses, cast, crew and trailers for ${lg} titles worldwide.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "keywords", content: `${lg} movies, ${lg} tv shows, ${lg} series, new ${lg} releases, ${lg} trailers, ${lg} reviews, best ${lg} movies` },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${g} Movies & TV Shows`,
            url,
            description,
            isPartOf: { "@type": "WebSite", name: "LumoroX AI", url: "https://lumorox.lovable.app/" },
            about: { "@type": "Thing", name: `${g} genre` },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://lumorox.lovable.app/" },
              { "@type": "ListItem", position: 2, name: "Genres", item: "https://lumorox.lovable.app/search" },
              { "@type": "ListItem", position: 3, name: g, item: url },
            ],
          }),
        },
      ],
    };
  },

  component: GenrePage,
  notFoundComponent: () => (
    <div className="container mx-auto px-4 py-20 text-center">
      <h1 className="font-display text-4xl">Genre not found</h1>
      <Link to="/" className="mt-4 inline-block text-brand hover:underline">← Back home</Link>
    </div>
  ),
});

function GenrePage() {
  const { genre } = Route.useLoaderData();

  const { data, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["tmdb", "genre-page", genre],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getGenrePage({ data: { genre, page: pageParam as number } }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    staleTime: 15 * 60_000,
  });

  const movies = data?.pages.flatMap((p) => p.movies) ?? [];

  return (
    <div className="container mx-auto px-4 py-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-sm text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back home
      </Link>

      <h1 className="text-gradient mt-4 font-display text-3xl tracking-tight sm:text-5xl">
        {genre} Movies
      </h1>
      <div className="accent-rule mt-2" />
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Every {genre.toLowerCase()} title, ordered from the newest releases down to the classics.
      </p>

      <ul
        aria-label={`${genre} movies, newest first`}
        className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {movies.map((m, i) => (
          <li key={`${m.id}-${i}`} className="w-full">
            <MovieCard movie={m} index={i} className="w-full" />
          </li>
        ))}
        {isFetching && !isFetchingNextPage && movies.length === 0 &&
          Array.from({ length: 12 }, (_, i) => (
            <li key={`sk-${i}`} className="w-full">
              <MovieCardSkeleton />
            </li>
          ))}
      </ul>

      <div aria-live="polite" className="mt-10 flex justify-center">
        {hasNextPage ? (
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-6 text-sm font-semibold transition hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            {isFetchingNextPage && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
            {isFetchingNextPage ? "Loading more…" : `Load more ${genre.toLowerCase()} movies`}
          </button>
        ) : (
          movies.length > 0 && (
            <p className="text-sm text-muted-foreground">You have reached the end of the {genre.toLowerCase()} catalogue.</p>
          )
        )}
      </div>
    </div>
  );
}
