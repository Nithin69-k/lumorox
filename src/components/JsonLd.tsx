/**
 * Renders a JSON-LD block for data that is only known on the client
 * (paginated / personalized lists that route `head()` cannot see).
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const SITE = "https://lumorox.lovable.app";

/** schema.org ItemList of movie/TV entries, in display order. */
export function itemListSchema(
  name: string,
  items: Array<{ id: string; title: string; year?: number; posterUrl?: string | null }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: items.slice(0, 50).map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}/movie/${m.id}`,
      item: {
        "@type": m.id.startsWith("tv-") ? "TVSeries" : "Movie",
        name: m.title,
        url: `${SITE}/movie/${m.id}`,
        ...(m.year ? { datePublished: String(m.year) } : {}),
        ...(m.posterUrl ? { image: m.posterUrl } : {}),
      },
    })),
  };
}
