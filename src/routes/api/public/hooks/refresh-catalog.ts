import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/**
 * Daily catalogue refresh endpoint.
 *
 * Called once a day (Vercel Cron, see vercel.json) to re-fetch the live TMDB
 * lists so the edge/runtime caches are warm with the newest titles before the
 * first visitor of the day arrives. It is safe to call at any time and never
 * returns user data.
 *
 * Secured with a shared secret: the caller must send
 * `Authorization: Bearer <CRON_SECRET>` (Vercel Cron does this automatically
 * when CRON_SECRET is set) or an `x-sync-secret` header matching
 * VERCEL_SYNC_SECRET. Unauthenticated calls are rejected with 401.
 */
const ENDPOINTS = [
  "/trending/movie/week",
  "/movie/now_playing",
  "/movie/popular",
  "/movie/top_rated",
  "/movie/upcoming",
] as const;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cronSecret = process.env["CRON_SECRET"]?.trim();
  if (cronSecret && bearer && safeEqual(bearer, cronSecret)) return true;

  const syncSecret = process.env["VERCEL_SYNC_SECRET"]?.trim();
  const provided = request.headers.get("x-sync-secret") ?? "";
  if (syncSecret && provided && safeEqual(provided, syncSecret)) return true;

  return false;
}

async function refresh(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env["TMDB_API_KEY"]?.trim();
  const accessToken = process.env["TMDB_ACCESS_TOKEN"]?.trim();
  if (!key && !accessToken) {
    return Response.json(
      { ok: false, error: "TMDB credentials not configured" },
      { status: 503 },
    );
  }

  const results = await Promise.all(
    ENDPOINTS.map(async (path) => {
      try {
        const url = new URL(`https://api.themoviedb.org/3${path}`);
        if (key) url.searchParams.set("api_key", key);
        url.searchParams.set("language", "en-US");
        url.searchParams.set("page", "1");
        // cache: no-store forces a fresh upstream read so the next request
        // repopulates caches with today's data.
        const headers = new Headers({ Accept: "application/json" });
        if (accessToken && !key) headers.set("Authorization", `Bearer ${accessToken}`);
        const res = await fetch(url.toString(), { cache: "no-store", headers });
        if (!res.ok) return { path, ok: false, status: res.status, count: 0 };
        const json = (await res.json()) as { results?: unknown[] };
        return { path, ok: true, status: 200, count: json.results?.length ?? 0 };
      } catch (error) {
        return {
          path,
          ok: false,
          status: 0,
          count: 0,
          error: error instanceof Error ? error.message : "unknown error",
        };
      }
    }),
  );

  const ok = results.every((r) => r.ok);
  return Response.json(
    { ok, refreshedAt: new Date().toISOString(), results },
    { status: ok ? 200 : 502, headers: { "cache-control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/public/hooks/refresh-catalog")({
  server: {
    handlers: {
      GET: async ({ request }) => refresh(request),
      POST: async ({ request }) => refresh(request),
    },
  },
});
