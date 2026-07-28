import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// Host-aware robots.txt so the same build works on Lovable, Vercel or a custom domain.
function baseUrl(request: Request): string {
  const explicit = process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return new URL(request.url).origin;
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const body = ["User-agent: *", "Allow: /", "", `Sitemap: ${baseUrl(request)}/sitemap.xml`, ""].join("\n");
        return new Response(body, {
          headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
