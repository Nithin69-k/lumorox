import { createFileRoute } from "@tanstack/react-router";

/**
 * Deployment parity probe. Reports WHICH environment variables the running
 * deployment can see (never their values) plus a live TMDB reachability check.
 * Use it right after a Vercel deploy: GET /api/public/health
 *
 * Note: the app is sign-in-free and fully client-local, so the backend auth
 * variables are optional and do not affect the status.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const has = (name: string) => Boolean(process.env[name]?.trim());
        const env = {
          TMDB_API_KEY: has("TMDB_API_KEY"),
          TMDB_ACCESS_TOKEN: has("TMDB_ACCESS_TOKEN"),
          SITE_URL: has("SITE_URL"),
        };

        let tmdb: { ok: boolean; status?: number; error?: string } = {
          ok: false,
          error: "no TMDB credentials configured",
        };
        const key = process.env["TMDB_API_KEY"]?.trim();
        const token = process.env["TMDB_ACCESS_TOKEN"]?.trim();
        if (key || token) {
          try {
            const url = new URL("https://api.themoviedb.org/3/configuration");
            if (key) url.searchParams.set("api_key", key);
            const res = await fetch(url.toString(), {
              headers: token && !key ? { Authorization: `Bearer ${token}` } : {},
            });
            tmdb = { ok: res.ok, status: res.status };
          } catch (e) {
            tmdb = { ok: false, error: e instanceof Error ? e.message : String(e) };
          }
        }

        const missing = [
          ...(!env.TMDB_API_KEY && !env.TMDB_ACCESS_TOKEN ? ["TMDB_API_KEY or TMDB_ACCESS_TOKEN"] : []),
        ];

        return new Response(
          JSON.stringify(
            {
              status: missing.length === 0 && tmdb.ok ? "ok" : "degraded",
              liveCatalogue: tmdb.ok,
              missing,
              env,
              tmdb,
              time: new Date().toISOString(),
            },
            null,
            2,
          ),
          { headers: { "content-type": "application/json", "cache-control": "no-store" } },
        );
      },
    },
  },
});
