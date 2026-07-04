import { cn } from "@/lib/utils";

export function MovieCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("w-[180px] shrink-0 sm:w-[200px]", className)}>
      <div className="aspect-[2/3] w-full animate-pulse rounded-lg bg-secondary/60" />
      <div className="mt-2 space-y-1.5">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-secondary/60" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-secondary/40" />
      </div>
    </div>
  );
}

export function MovieRowSkeleton({ title }: { title?: string }) {
  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        {title && <h2 className="font-display text-2xl tracking-wide sm:text-3xl">{title}</h2>}
      </div>
      <div className="mt-4 flex gap-4 overflow-hidden px-4 sm:px-[max(1rem,calc((100vw-1280px)/2+1rem))]">
        {Array.from({ length: 8 }).map((_, i) => <MovieCardSkeleton key={i} />)}
      </div>
    </section>
  );
}

export function MovieGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => <MovieCardSkeleton key={i} className="w-full" />)}
    </div>
  );
}
