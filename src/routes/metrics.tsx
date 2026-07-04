import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3, Download, Loader2 } from "lucide-react";
import { useUserStore } from "@/store/user";
import { getPersonalizedRecommendations, type ScoredMovie } from "@/lib/tmdb.functions";

export const Route = createFileRoute("/metrics")({
  head: () => ({
    meta: [
      { title: "Scoring Metrics — LumoroX AI" },
      { name: "description", content: "Internal recommendation scoring breakdown, distribution, and offline evaluation." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MetricsPage,
});

function MetricsPage() {
  const likes = useUserStore((s) => s.likes);
  const watchlist = useUserStore((s) => s.watchlist);
  const dislikes = useUserStore((s) => s.dislikes);
  const ratings = useUserStore((s) => s.ratings);

  const { data: recs = [], isFetching } = useQuery({
    queryKey: ["recs", "personalized", likes.join(","), dislikes.join(","), watchlist.join(","), JSON.stringify(ratings)],
    queryFn: () => getPersonalizedRecommendations({
      data: { likes, dislikes, watchlist, ratings },
    }),
    staleTime: 5 * 60_000,
  });

  // Offline eval: hold out 20% of high-rated titles, re-run recs, compute
  // Precision@10 = fraction of held-out set that appears in top-10 recs.
  const highRated = useMemo(() => Object.entries(ratings).filter(([, r]) => r >= 7).map(([id]) => id), [ratings]);
  const holdoutCount = Math.max(0, Math.floor(highRated.length * 0.2));
  const holdout = highRated.slice(0, holdoutCount);
  const trainRatings = useMemo(() => {
    const cp: Record<string, number> = { ...ratings };
    for (const id of holdout) delete cp[id];
    return cp;
  }, [ratings, holdout]);
  const trainLikes = useMemo(() => likes.filter((id) => !holdout.includes(id)), [likes, holdout]);

  const [runEval, setRunEval] = useState(false);
  const { data: evalRecs = [], isFetching: isFetchingEval } = useQuery({
    enabled: runEval && holdout.length > 0,
    queryKey: ["recs", "eval", trainLikes.join(","), JSON.stringify(trainRatings), holdout.join(",")],
    queryFn: () => getPersonalizedRecommendations({
      data: { likes: trainLikes, dislikes, watchlist: [], ratings: trainRatings },
    }),
    staleTime: 5 * 60_000,
  });

  const precisionAt10 = useMemo(() => {
    if (evalRecs.length === 0 || holdout.length === 0) return null;
    const top10 = evalRecs.slice(0, 10).map((r) => r.movie.id);
    const hits = top10.filter((id) => holdout.includes(id)).length;
    return hits / Math.min(10, holdout.length);
  }, [evalRecs, holdout]);

  const histogram = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      bucket: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`,
      count: 0,
    }));
    for (const r of recs) {
      const idx = Math.min(9, Math.max(0, Math.floor(r.score * 10)));
      buckets[idx].count += 1;
    }
    return buckets;
  }, [recs]);

  const avgScore = recs.length > 0 ? recs.reduce((s, r) => s + r.score, 0) / recs.length : 0;
  const avgGenre = recs.length > 0 ? recs.reduce((s, r) => s + r.breakdown.genre, 0) / recs.length : 0;
  const avgKw = recs.length > 0 ? recs.reduce((s, r) => s + r.breakdown.keyword, 0) / recs.length : 0;

  const exportReport = () => {
    const lines: string[] = [];
    lines.push("# LumoroX AI — Recommendation Scoring Report");
    lines.push("");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Seeds: ${likes.length} likes, ${highRated.length} rated ≥7`);
    lines.push(`Recommendations returned: ${recs.length}`);
    lines.push(`Average final score: ${avgScore.toFixed(3)}`);
    lines.push(`Average genre-overlap component: ${avgGenre.toFixed(3)}`);
    lines.push(`Average keyword-overlap component: ${avgKw.toFixed(3)}`);
    if (precisionAt10 !== null) lines.push(`Precision@10 (holdout=${holdout.length}): ${precisionAt10.toFixed(3)}`);
    lines.push("");
    lines.push("## Score distribution");
    for (const b of histogram) lines.push(`- ${b.bucket}: ${b.count}`);
    lines.push("");
    lines.push("## Top recommendations");
    lines.push("| # | Title | Year | Score | Genre | Keyword | Cast | Director | Pop | Quality | Reason |");
    lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
    recs.slice(0, 15).forEach((r, i) => {
      lines.push(`| ${i + 1} | ${r.movie.title} | ${r.movie.year} | ${r.score.toFixed(3)} | ${r.breakdown.genre.toFixed(2)} | ${r.breakdown.keyword.toFixed(2)} | ${r.breakdown.cast.toFixed(2)} | ${r.breakdown.director.toFixed(2)} | ${r.breakdown.popularity.toFixed(2)} | ${r.breakdown.quality.toFixed(2)} | ${r.reason} |`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumorox-scoring-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl brand-gradient shadow-[var(--shadow-glow)]">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-4xl tracking-tight">Scoring Metrics</h1>
            <p className="mt-1 text-sm text-muted-foreground">Internal view · how LumoroX ranks and explains each recommendation.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportReport}
            disabled={recs.length === 0}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:border-brand hover:text-brand disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export report
          </button>
          <Link to="/recommendations" className="inline-flex items-center rounded-md brand-gradient px-3 py-2 text-sm font-semibold text-white">
            Back to picks
          </Link>
        </div>
      </div>

      {isFetching && (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Scoring candidates…
        </p>
      )}

      {!isFetching && recs.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No recommendations yet — like a few movies first.
        </p>
      )}

      {recs.length > 0 && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Recs" value={String(recs.length)} />
            <StatCard label="Avg score" value={avgScore.toFixed(3)} />
            <StatCard label="Avg genre overlap" value={avgGenre.toFixed(3)} />
            <StatCard label="Avg keyword overlap" value={avgKw.toFixed(3)} />
          </div>

          <section className="mt-8 rounded-2xl border border-border bg-secondary/30 p-4 sm:p-6">
            <h2 className="font-display text-xl">Score distribution</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogram}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="bucket" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-border bg-secondary/30 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">Offline evaluation</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hold out 20% of high-rated titles ({holdout.length} of {highRated.length}), re-run recs on the rest, measure Precision@10.
                </p>
              </div>
              <button
                onClick={() => setRunEval(true)}
                disabled={holdout.length === 0 || isFetchingEval}
                className="inline-flex items-center gap-2 rounded-md brand-gradient px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {isFetchingEval ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {runEval ? "Re-run" : "Run evaluation"}
              </button>
            </div>
            {precisionAt10 !== null && (
              <p className="mt-4 text-sm">
                <span className="text-muted-foreground">Precision@10:</span>{" "}
                <span className="font-display text-2xl text-brand">{precisionAt10.toFixed(3)}</span>
                <span className="ml-2 text-xs text-muted-foreground">(higher is better; 0 = no held-out titles recovered in top 10)</span>
              </p>
            )}
            {holdout.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">Rate at least 5 titles ≥7 to enable evaluation.</p>
            )}
          </section>

          <section className="mt-8 overflow-x-auto rounded-2xl border border-border bg-secondary/30">
            <table className="min-w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>#</Th><Th>Title</Th><Th>Score</Th><Th>Genre</Th><Th>Keyword</Th><Th>Cast</Th><Th>Director</Th><Th>Pop</Th><Th>Quality</Th><Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {recs.map((r, i) => <Row key={r.movie.id} r={r} idx={i + 1} />)}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl text-foreground">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}

function Row({ r, idx }: { r: ScoredMovie; idx: number }) {
  const b = r.breakdown;
  return (
    <tr className="border-t border-border/60 hover:bg-accent/30">
      <td className="px-3 py-2 text-muted-foreground">{idx}</td>
      <td className="px-3 py-2 font-medium text-foreground">{r.movie.title} <span className="text-muted-foreground">({r.movie.year})</span></td>
      <td className="px-3 py-2 font-mono text-brand">{r.score.toFixed(3)}</td>
      <td className="px-3 py-2 font-mono text-muted-foreground">{b.genre.toFixed(2)}</td>
      <td className="px-3 py-2 font-mono text-muted-foreground">{b.keyword.toFixed(2)}</td>
      <td className="px-3 py-2 font-mono text-muted-foreground">{b.cast.toFixed(2)}</td>
      <td className="px-3 py-2 font-mono text-muted-foreground">{b.director.toFixed(2)}</td>
      <td className="px-3 py-2 font-mono text-muted-foreground">{b.popularity.toFixed(2)}</td>
      <td className="px-3 py-2 font-mono text-muted-foreground">{b.quality.toFixed(2)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{r.reason}</td>
    </tr>
  );
}
