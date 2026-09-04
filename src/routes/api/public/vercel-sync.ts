import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual, createHmac } from "crypto";

/**
 * POST /api/public/vercel-sync
 * Pushes TMDB_API_KEY into the linked Vercel project (all environments)
 * and triggers a production redeploy of the latest commit.
 *
 * Secured with a shared secret: send header `x-sync-secret` matching
 * the VERCEL_SYNC_SECRET env var.
 */
export const Route = createFileRoute("/api/public/vercel-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const syncSecret = process.env["VERCEL_SYNC_SECRET"];
        const provided = request.headers.get("x-sync-secret") ?? "";
        if (!syncSecret || !provided) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const a = Buffer.from(provided);
        const b = Buffer.from(syncSecret);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const vercelToken = process.env["VERCEL_TOKEN"]?.trim();
        const tmdbKey = (process.env["TMDB_API_KEY"] || process.env["TMDB_ACCESS_TOKEN"])?.trim();
        const projectName = process.env["VERCEL_PROJECT_NAME"]?.trim() || "lumorox";

        if (!vercelToken) {
          return Response.json(
            { error: "VERCEL_TOKEN secret is not set" },
            { status: 500 },
          );
        }
        if (!tmdbKey) {
          return Response.json(
            { error: "No TMDB key available to sync" },
            { status: 500 },
          );
        }

        const api = "https://api.vercel.com";
        const headers = {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        };
        const steps: Record<string, unknown> = {};

        // 1. Resolve the project
        const projRes = await fetch(`${api}/v9/projects/${encodeURIComponent(projectName)}`, { headers });
        if (!projRes.ok) {
          const body = await projRes.text();
          return Response.json(
            { error: `Could not find Vercel project "${projectName}". Set VERCEL_PROJECT_NAME to your exact Vercel project slug.`, status: projRes.status, detail: body.slice(0, 300) },
            { status: 502 },
          );
        }
        const project = (await projRes.json()) as { id: string; name: string };
        steps["project"] = { id: project.id, name: project.name };

        // 2. Upsert TMDB_API_KEY for production, preview and development
        const envPayload = {
          key: "TMDB_API_KEY",
          value: tmdbKey,
          type: "encrypted",
          target: ["production", "preview", "development"],
        };
        let envRes = await fetch(`${api}/v10/projects/${project.id}/env?upsert=true`, {
          method: "POST",
          headers,
          body: JSON.stringify(envPayload),
        });
        if (!envRes.ok) {
          // Older API version fallback
          envRes = await fetch(`${api}/v9/projects/${project.id}/env?upsert=true`, {
            method: "POST",
            headers,
            body: JSON.stringify(envPayload),
          });
        }
        const envBody = await envRes.text();
        steps["envVar"] = { ok: envRes.ok, status: envRes.status, detail: envBody.slice(0, 300) };
        if (!envRes.ok) {
          return Response.json({ error: "Failed to set TMDB_API_KEY in Vercel", steps }, { status: 502 });
        }

        // 3. Trigger a production redeploy from the project's linked git repo
        const latestRes = await fetch(
          `${api}/v6/deployments?projectId=${project.id}&target=production&limit=1`,
          { headers },
        );
        let redeploy: Record<string, unknown> = { attempted: false };
        if (latestRes.ok) {
          const latest = (await latestRes.json()) as {
            deployments?: Array<{ uid: string; meta?: Record<string, unknown> }>;
          };
          const prev = latest.deployments?.[0];
          if (prev) {
            const redeployRes = await fetch(`${api}/v13/deployments`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: project.name,
                deploymentId: prev.uid,
                target: "production",
              }),
            });
            const redeployBody = await redeployRes.text();
            redeploy = {
              attempted: true,
              ok: redeployRes.ok,
              status: redeployRes.status,
              detail: redeployBody.slice(0, 400),
            };
          }
        }
        steps["redeploy"] = redeploy;

        return Response.json({
          ok: true,
          message: "TMDB_API_KEY synced to Vercel (production/preview/development) and redeploy triggered.",
          steps,
        });
      },
      GET: async () =>
        Response.json({
          hint: "POST with header x-sync-secret to sync TMDB_API_KEY to Vercel and redeploy.",
        }),
    },
  },
});
