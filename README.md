# LumoroX AI

Cinematic AI movie discovery: TMDB-powered catalogue, hybrid recommendations,
semantic + natural-language search, watchlists and mood discovery.

Stack: TanStack Start (v1) · React 19 · Vite 7 · Tailwind CSS v4 · shadcn/ui ·
TanStack Query · Zustand · Zod · Supabase.

## Local development

```bash
npm install          # or bun install
cp .env.example .env # fill in the values
npm run dev          # http://localhost:8080
```

Useful scripts:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build (SSR + client + server bundle) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint |

## Environment variables

See `.env.example`. Two classes:

- `VITE_*` — public, inlined into the browser bundle.
- everything else — server-only, read **inside** server function handlers
  (`process.env.X` at module scope is `undefined` on serverless runtimes).

Required for a fully working deployment: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`TMDB_API_KEY`. Optional: `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`,
`OPENAI_API_KEY` (AI search), `SITE_URL`.

## Deploying to Vercel

The build uses Nitro, which auto-detects Vercel and emits the Build Output API
v3 bundle in `.vercel/output`. `vercel.json` pins that wiring, so no framework
preset is needed.

1. Import the repository in Vercel (Framework Preset: **Other** — `vercel.json`
   already sets build/install/output).
2. Add every variable from `.env.example` under **Settings → Environment
   Variables** for Production *and* Preview. `VITE_*` values must exist at
   **build** time; server-only values are read at request time.
3. Deploy. Routes are server-rendered, and `/sitemap.xml` and `/robots.txt` are
   generated per request from the deployment host (or `SITE_URL` if set).
4. Add your custom domain and set `SITE_URL` to it so canonical SEO URLs match.

Notes:

- Node.js 20+ is required (Vercel default is fine).
- Supabase must allow your Vercel domain in **Auth → URL configuration**
  (Site URL + redirect URLs) for Google/email sign-in to work.
- TMDB responses are cached in-memory per warm instance with per-endpoint TTLs;
  no extra cache infrastructure is needed.

### CLI deploy

```bash
npm i -g vercel
vercel link
vercel env pull .env.local
vercel --prod
```

## Other targets

The same build runs on any Nitro-supported platform. Set `NITRO_PRESET`
(e.g. `node-server`, `netlify`, `cloudflare-module`) before `npm run build`.
