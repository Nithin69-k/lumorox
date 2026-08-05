import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, Send, Loader2, Wand2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MovieCard } from "@/components/MovieCard";
import { MovieGridSkeleton } from "@/components/MovieCardSkeleton";
import { askAi, type AskResult } from "@/lib/semantic.functions";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "Ask LumoroX — Natural-Language Movie Search" },
      { name: "description", content: "Describe the movie you want in plain English. LumoroX AI parses your intent, embeds it, and finds semantic matches with explainable reasons." },
      { property: "og:title", content: "Ask LumoroX — Natural-Language Movie Search" },
      { property: "og:description", content: "Describe the movie you want in plain English. LumoroX AI parses your intent and finds semantic matches." },
      { property: "og:url", content: "https://lumorox.lovable.app/ask" },
    ],
    links: [{ rel: "canonical", href: "https://lumorox.lovable.app/ask" }],
  }),
  component: AskPage,
});

const EXAMPLES = [
  "A slow-burn mystery like Prisoners",
  "Feel-good animated movies for a rainy Sunday",
  "Mind-bending sci-fi from the 2010s, rated 8+",
  "Gritty crime dramas directed by Denis Villeneuve",
  "Weird horror that's more atmosphere than jump-scares",
];

function AskPage() {
  const [q, setQ] = useState("");
  const mutation = useMutation<AskResult, Error, string>({
    mutationFn: (query) => askAi({ data: { q: query } }),
  });

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) return;
    setQ(trimmed);
    mutation.mutate(trimmed);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl brand-gradient shadow-[var(--shadow-glow)]">
          <Wand2 className="h-7 w-7 text-white" />
        </div>
        <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">Ask LumoroX</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Describe the movie you're in the mood for. We'll parse your intent with an LLM, embed the meaning, and match it semantically — not just by tags.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(q); }}
        className="mx-auto mt-6 flex w-full max-w-3xl items-center gap-2 rounded-2xl glass p-2 shadow-[var(--shadow-card)] focus-within:ring-2 focus-within:ring-brand/60"
      >
        <Sparkles className="ml-2 h-5 w-5 shrink-0 text-brand" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. a slow-burn mystery like Prisoners"
          aria-label="Describe the movie you want"
          className="flex-1 bg-transparent px-2 py-3 text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={mutation.isPending || q.trim().length < 2}
          className="inline-flex items-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-glow)] transition disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ask
        </button>
      </form>

      {!mutation.data && !mutation.isPending && (
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => submit(ex)}
              className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-brand hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {mutation.isPending && (
        <div className="mt-10">
          <div className="mx-auto mb-6 h-4 w-64 animate-pulse rounded bg-secondary/60" />
          <MovieGridSkeleton count={12} />
        </div>
      )}

      {mutation.isError && (
        <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
          Something went wrong: {mutation.error.message}
        </div>
      )}

      <AnimatePresence>
        {mutation.data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-10"
          >
            <div className="mx-auto mb-6 max-w-3xl rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-sm text-foreground">{mutation.data.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                {mutation.data.parsed.referenceTitle && (
                  <span className="rounded-full bg-brand/20 px-2 py-0.5 text-brand">↳ {mutation.data.parsed.referenceTitle}</span>
                )}
                {mutation.data.parsed.mood && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">{mutation.data.parsed.mood}</span>
                )}
                {mutation.data.parsed.genres.map((g) => (
                  <span key={g} className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">{g}</span>
                ))}
                {mutation.data.parsed.minRating && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">≥ {mutation.data.parsed.minRating}/10</span>
                )}
                {(mutation.data.parsed.yearMin || mutation.data.parsed.yearMax) && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                    {mutation.data.parsed.yearMin ?? "…"}–{mutation.data.parsed.yearMax ?? "…"}
                  </span>
                )}
              </div>
            </div>

            {mutation.data.matches.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">No semantic matches yet — the index is still warming up. Try a different phrasing or browse a few movies first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {mutation.data.matches.map((m, i) => (
                  <MovieCard key={m.movie.id} movie={m.movie} index={i} reason={m.reason} className="w-full" />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
