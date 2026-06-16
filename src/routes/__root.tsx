import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Navbar } from "@/components/Navbar";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-[7rem] leading-none text-brand">404</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Lost in the multiverse</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist — but we have thousands of movies that do.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md brand-gradient px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Back to CineVerse
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try refreshing — your library is safe in local storage.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md brand-gradient px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CineVerse AI — Cinematic Movie Recommendations" },
      { name: "description", content: "Discover your next favorite film. AI-powered movie recommendations, mood matching, watchlists, and a curated cinematic library." },
      { name: "author", content: "CineVerse AI" },
      { name: "theme-color", content: "#0b0b0f" },
      { property: "og:site_name", content: "CineVerse AI" },
      { property: "og:title", content: "CineVerse AI — Cinematic Movie Recommendations" },
      { property: "og:description", content: "AI-powered movie recommendations, mood matching, and a curated cinematic library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CineVerse AI" },
      { name: "twitter:description", content: "Discover your next favorite film." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "CineVerse AI",
          description: "AI-powered movie recommendations.",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Navbar />
      <main className="min-h-screen pt-28 md:pt-16">
        <Outlet />
      </main>
      <footer className="border-t border-border py-10 mt-12 text-center text-xs text-muted-foreground">
        <p>CineVerse AI · Powered by curated cinema & local intelligence</p>
      </footer>
    </QueryClientProvider>
  );
}
