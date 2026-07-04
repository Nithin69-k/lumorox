## Codebase Audit

**Frontend**
- TanStack Start v1 (SSR on Cloudflare Workers) + React 19 + TypeScript
- Routing: file-based via `src/routes/*` (TanStack Router)
- Data fetching: TanStack Query + `createServerFn` RPCs
- Styling: Tailwind v4 + shadcn/ui (Radix), Framer Motion animations, Lucide icons
- Theme: "Netflix Noir" dark palette in `src/styles.css`
- Client state: Zustand with `persist` (localStorage key `lumorox-user-v1`)

**Backend / Database**
- No database. No auth. Fully serverless via TanStack server functions running on Cloudflare Workers.
- Only server secret: `TMDB_API_KEY`.
- User signals (likes, dislikes, watchlist, 0–10 ratings) live in browser localStorage via `useUserStore` — nothing persisted server-side.

**Movie data source**
- Live TMDB v3 REST API (`api.themoviedb.org/3`) proxied through `src/lib/tmdb.functions.ts`.
- Endpoints wired: `/trending`, `/popular`, `/top_rated`, `/upcoming`, `/discover/movie`, `/search/movie`, `/movie/{id}` (with credits, videos, keywords), `/movie/{id}/recommendations`.
- Two-layer cache: in-memory TTL Map (per warm worker) + Cloudflare `cf.cacheTtl`, with stale-on-error fallback.
- A small static seed catalog exists in `src/data/movies.ts` (~30 titles with director/cast/keywords) but is no longer the primary source — only used as the `Movie` type contract.

**Recommendation logic (current)**
- `src/lib/recommendation.ts` — client-side, **rule/content-based only**:
  - `contentSimilarity`: weighted overlap of genres (0.45), keywords (0.20), cast (0.15), director (0.10), year proximity (0.10).
  - `recommendFor(signals)`: averages content similarity against liked / high-rated titles, blended 60/20/20 with popularity and quality.
  - `moodRecommendations`, `trending`, `topRated`, `popular`, `upcoming`, `byGenre` — filter/sort helpers over the static seed.
- `src/routes/recommendations.tsx` — currently bypasses the local scorer and just calls TMDB's `/movie/{id}/recommendations` for each liked seed and interleaves results. No explanations, no embeddings, no collaborative filtering.
- No ML, no embeddings, no LLM anywhere yet.

**Auth / user system**
- None. Anonymous. All personalization is local-only.

---

## Proposed Upgrade Plan (fits current architecture, doesn't replace it)

Phases are independently shippable. Each keeps TanStack Start + TMDB as-is and layers new capabilities behind server functions.

### Phase 1 — Smarter content-based recs (no new infra)
- Rehydrate TMDB list items with lightweight details (director, top cast, keywords) on demand and cache per-movie for 6h (already partly cached). Store enriched `Movie` objects in a server-side LRU so the local `contentSimilarity` scorer has real signal beyond genres.
- Use the existing `recommendFor` blender but source the candidate pool from a merged TMDB set (liked-seed `/similar` ∪ trending ∪ top-genre-of-likes) instead of the static seed.
- Add a `scoreBreakdown` field per recommended movie: `{ genre, keyword, cast, director, year, popularity, quality, total }`.

### Phase 2 — Explainability layer
- Derive a short human reason from `scoreBreakdown` + user signals:
  - "Same director as *The Prestige* you liked"
  - "Shares 3 keywords with *Prisoners*"
  - "Because you rated *Se7en* 9/10"
  - "Trending in Mystery — a genre you watch often"
- Surface as a caption under each `MovieCard` on `/recommendations` and on the movie detail "More like this" row.

### Phase 3 — Semantic / embedding similarity
- Enable Lovable Cloud → Postgres + `pgvector`.
- New table `movie_embeddings(tmdb_id, embedding vector(1536), text_hash, updated_at)` with HNSW cosine index. Grants: `service_role` only (backfilled/read via server fn; no client access).
- Server fn `embedMovie(id)`: build a text blob `${title}. ${overview} Genres: ... Keywords: ... Directed by ... Starring ...`, embed via Lovable AI Gateway using `openai/text-embedding-3-small` (1536-dim → matches column), upsert. Lazy: embed on first detail view; opportunistic backfill for trending/top-rated.
- Server fn `semanticSimilar(id, k=20)`: cosine KNN in Postgres; fallback to TMDB `/recommendations` when the movie isn't embedded yet.
- Blend into `recommendFor`: `0.35 semantic + 0.30 content + 0.20 popularity + 0.15 quality`.

### Phase 4 — Natural-language search
- New route `/ask` (also inline on `/search`): text box → server fn `parseQuery(q)` calls Lovable AI (`google/gemini-3-flash-preview`) with a Zod-validated structured output schema:
  ```
  { genres?: Genre[], yearMin?, yearMax?, minRating?, mood?, keywords?: string[], referenceTitle?: string, tone?: 'slow-burn'|'fast-paced'|... }
  ```
- Server fn `answerQuery(parsed)`:
  1. If `referenceTitle` set → resolve via `/search/movie` → semantic KNN on its embedding.
  2. Else → embed the free-text query, KNN against `movie_embeddings`, then hard-filter by structured fields (genre/year/rating).
  3. Return matches + a one-sentence "why these" explanation from the LLM.

### Phase 5 — Optional lightweight user accounts + collaborative signal
- Enable Lovable Cloud auth (email + Google) — opt-in; anonymous flow keeps working via localStorage.
- Tables (with RLS + `user_roles` pattern):
  - `user_ratings(user_id, tmdb_id, rating, created_at)`
  - `user_events(user_id, tmdb_id, kind: 'like'|'dislike'|'watchlist'|'view', created_at)`
- Sync existing Zustand state on sign-in (one-shot merge).
- Item-item collaborative signal: nightly (or on-demand) job builds a co-liked matrix `sim(a,b) = |users who liked both| / sqrt(|a| * |b|)`; server fn `collabSimilar(id)` returns top-k. Blended into the final score at 0.15 once there is enough data; falls back to content+semantic otherwise.

### Phase 6 — Evaluation / credibility report
- Internal route `/metrics` (dev-only gate: `import.meta.env.DEV || ?key=…`):
  - Score distribution histogram (recharts) for the current user's recs.
  - Per-recommendation table: title, semantic score, content score, popularity, final, reason.
  - Offline eval: hold out 20% of user's high ratings, run recs on the rest, compute Precision@10 / MAP@10 / average cosine to held-out set. Show a summary card.
  - "Export report" → downloads a Markdown/PDF snapshot with charts + numbers (screenshot-ready for portfolio/README).

### Phase 7 — Polish
- Skeleton loaders for `MovieRow`, `MovieCard`, hero (replace bare `Loader2`).
- Better empty states on `/watchlist`, `/recommendations`, `/search` (illustration + CTA).
- Micro-interactions: card hover parallax, watchlist add toast + count badge, rating bar with keyboard shortcuts (1–9).
- Preserve Netflix Noir palette, typography, gradients, and glass surfaces — only enhance.

---

## Technical Notes
- **Stack fit**: everything runs as `createServerFn` handlers under `src/lib/*.functions.ts`; no new frameworks. LLM/embeddings via Lovable AI Gateway (`LOVABLE_API_KEY` already server-only). Vector storage via Lovable Cloud (Supabase + `pgvector`).
- **Cost control**: embeddings are lazy + cached forever (keyed by `text_hash`); LLM parses only run on explicit NL-search submits; all TMDB paths keep the existing edge cache.
- **Backwards compatible**: `useUserStore` (localStorage) stays the source of truth until Phase 5; Phase 5 syncs into it rather than replacing it.
- **Risk**: Phase 3 requires enabling Lovable Cloud (adds a DB). If you'd rather stay DB-less, we can hold the embedding index in a per-worker LRU + KV, at the cost of cold-start recompute.

## Deliverables per phase
Each phase ends with: updated server fns, UI wiring, a short README section documenting the new signal, and — from Phase 6 onward — the metrics export.

Confirm the audit and tell me:
1. Green-light all phases in order, or cherry-pick?
2. OK to enable Lovable Cloud at Phase 3 (needed for pgvector + auth), or keep DB-less?
