import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MOODS, type MoodId } from "@/data/genres";
import { moodRecommendations } from "@/lib/recommendation";
import { MovieCard } from "@/components/MovieCard";

export const Route = createFileRoute("/mood")({
  head: () => ({
    meta: [
      { title: "Mood Recommendations — CineVerse AI" },
      { name: "description", content: "Pick a mood and get instant cinematic recommendations curated for the feeling." },
      { property: "og:title", content: "Mood Recommendations — CineVerse AI" },
      { property: "og:url", content: "/mood" },
    ],
    links: [{ rel: "canonical", href: "/mood" }],
  }),
  component: MoodPage,
});

function MoodPage() {
  const [mood, setMood] = useState<MoodId>("happy");
  const list = moodRecommendations(mood, 18);

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="font-display text-4xl tracking-tight sm:text-5xl">How are you feeling?</h1>
      <p className="mt-2 text-sm text-muted-foreground">We'll match the mood to the movie.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {MOODS.map((m) => {
          const active = m.id === mood;
          return (
            <button
              key={m.id}
              onClick={() => setMood(m.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${active ? "border-brand bg-brand text-brand-foreground shadow-[var(--shadow-glow)]" : "border-border bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              <span className="text-base">{m.emoji}</span> {m.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mood}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          {list.map((m, i) => <MovieCard key={m.id} movie={m} index={i} className="w-full" />)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
