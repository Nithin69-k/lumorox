import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// Resolved per-request so the same build works on Lovable, Vercel or a custom domain.
function baseUrl(request: Request): string {
  const explicit = process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  try {
    const origin = new URL(request.url).origin;
    if (origin.startsWith("http")) return origin;
  } catch {
    /* fall through */
  }
  return "https://lumorox.lovable.app";
}


interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const BASE_URL = baseUrl(request);
        const { MOVIES } = await import("@/data/movies");
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/search", changefreq: "weekly", priority: "0.8" },
          { path: "/recommendations", changefreq: "daily", priority: "0.8" },
          { path: "/mood", changefreq: "weekly", priority: "0.7" },
          { path: "/ask", changefreq: "weekly", priority: "0.8" },
          { path: "/watchlist", changefreq: "monthly", priority: "0.5" },
          ...MOVIES.map((m) => ({ path: `/movie/${m.id}`, changefreq: "monthly" as const, priority: "0.6" })),
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
