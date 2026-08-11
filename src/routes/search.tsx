import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X, Mic, MicOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { MovieCard } from "@/components/MovieCard";
import { GENRES } from "@/data/genres";
import { motion } from "framer-motion";
import { discoverMovies } from "@/lib/tmdb.functions";

const searchSchema = z.object({
  q: z.string().catch(""),
  genre: z.string().catch(""),
  year: z.string().catch(""),
  min: z.coerce.number().min(0).max(10).catch(0),
  sort: z.enum(["popularity", "rating", "year", "title"]).catch("popularity"),
});

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Search Movies — LumoroX AI" },
      { name: "description", content: "Search and filter thousands of movies by genre, rating, and year via TMDB." },
      { property: "og:title", content: "Search Movies — LumoroX AI" },
      { property: "og:url", content: "https://lumorox.lovable.app/search" },
    ],
    links: [{ rel: "canonical", href: "https://lumorox.lovable.app/search" }],
  }),
  component: SearchPage,
});

const YEARS = Array.from({ length: 2025 - 1950 + 1 }, (_, i) => 2025 - i);

function SearchPage() {
  const navigate = useNavigate({ from: "/search" });
  const { q, genre, year, min, sort } = Route.useSearch();
  const [input, setInput] = useState(q);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, q: input }), replace: true });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  const startVoice = () => {
    type SR = { start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; continuous: boolean; interimResults: boolean; lang: string };
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const recog = new Ctor();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = "en-US";
    recog.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
    };
    recog.onend = () => setListening(false);
    setListening(true);
    recog.start();
  };

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["tmdb", "discover", q, genre, year, min, sort],
    queryFn: () => discoverMovies({ data: { q, genre, year, min, sort } }),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const setFilter = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch }), replace: true });

  return (
    <main className="container mx-auto px-4 py-6">
      <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Search the cinematic universe</h1>
      <p className="mt-2 text-sm text-muted-foreground">Powered by TMDB — search millions of titles, filter by genre, year, and rating.</p>

      <div className="mt-6 flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search titles, actors, directors, keywords…"
            aria-label="Search movies"
            className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-14 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-brand focus-visible:ring-2 focus-visible:ring-ring"
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {voiceSupported && (
          <button
            type="button"
            onClick={startVoice}
            aria-label={listening ? "Listening..." : "Voice search"}
            className={`grid h-14 w-14 place-items-center rounded-2xl border transition ${listening ? "border-brand bg-brand text-brand-foreground animate-pulse" : "border-border hover:border-brand"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
          >
            {listening ? <MicOff aria-hidden className="h-5 w-5" /> : <Mic aria-hidden className="h-5 w-5" />}
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <select value={genre} onChange={(e) => setFilter({ genre: e.target.value })} aria-label="Genre" className="h-11 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <option value="">All genres</option>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={year} onChange={(e) => setFilter({ year: e.target.value })} aria-label="Year" className="h-11 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <option value="">Any year</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={String(min)} onChange={(e) => setFilter({ min: Number(e.target.value) })} aria-label="Minimum rating" className="h-11 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          {[0, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n === 0 ? "Any rating" : `${n}+ stars`}</option>)}
        </select>
        <select value={sort} onChange={(e) => setFilter({ sort: e.target.value as z.infer<typeof searchSchema>["sort"] })} aria-label="Sort by" className="h-11 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <option value="popularity">Most popular</option>
          <option value="rating">Highest rated</option>
          <option value="year">Newest</option>
          <option value="title">A → Z</option>
        </select>
      </div>

      <p aria-live="polite" className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        {isFetching && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
        {results.length} {results.length === 1 ? "result" : "results"}
      </p>

      <motion.div
        layout
        className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {results.map((m, i) => (
          <div key={m.id} className="w-full">
            <MovieCard movie={m} index={i} className="w-full" />
          </div>
        ))}
      </motion.div>

      {!isFetching && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-display text-2xl">No matches</p>
          <p className="mt-2 text-sm text-muted-foreground">Try a different keyword, or clear your filters.</p>
        </div>
      )}
    </main>
  );
}
