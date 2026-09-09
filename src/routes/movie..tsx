
/** Legal streaming / rent / buy options, sourced from TMDB's provider data. */
function WhereToWatch({ id, title }: { id: string; title: string }) {
  const { data } = useQuery({
    queryKey: ["tmdb", "providers", id],
    queryFn: () => getWatchProviders({ data: { id } }),
    staleTime: 6 * 60 * 60_000,
  });
  if (!data) return null;
  const groups: { label: string; items: WatchProvider[] }[] = [
    { label: "Stream", items: data.stream },
    { label: "Rent", items: data.rent },
    { label: "Buy", items: data.buy },
  ].filter((g) => g.items.length > 0);
  if (groups.length === 0) return null;

  return (
    <section className="mt-7" aria-label={`Where to watch ${title}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Where to watch</h2>
        {data.link && (
          <a
            href={data.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand/60 px-3 text-xs font-semibold text-brand hover:bg-brand hover:text-brand-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ExternalLink aria-hidden className="h-3.5 w-3.5" /> All options
          </a>
        )}
      </div>
      <div className="mt-3 space-y-3">
        {groups.map((g) => (
          <div key={g.label} className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">{g.label}</span>
            {g.items.map((p) => {
              const inner = (
                <>
                  {p.logoUrl ? (
                    <img src={p.logoUrl} alt="" loading="lazy" className="h-6 w-6 rounded-md object-cover" />
                  ) : null}
                  <span className="max-w-[9rem] truncate">{p.name}</span>
                </>
              );
              const cls =
                "inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs text-foreground transition hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
              return data.link ? (
                <a
                  key={`${g.label}-${p.id}`}
                  href={data.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${g.label} ${title} on ${p.name}`}
                  className={cls}
                >
                  {inner}
                </a>
              ) : (
                <span key={`${g.label}-${p.id}`} className={cls}>{inner}</span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Streaming availability by JustWatch via TMDB.</p>
    </section>
  );
}
