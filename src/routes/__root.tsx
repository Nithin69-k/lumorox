import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";

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
            Back to LumoroX
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
      { title: "LumoroX AI — Cinematic Movie Recommendations" },
      { name: "description", content: "Discover your next favorite film. AI-powered movie recommendations, mood matching, watchlists, and a curated cinematic library." },
      { name: "author", content: "LumoroX AI" },
      { name: "theme-color", content: "#0b0b0f" },
      { name: "google-adsense-account", content: "ca-pub-8810843904982932" },
      { property: "og:site_name", content: "LumoroX AI" },
      { property: "og:title", content: "LumoroX AI — Cinematic Movie Recommendations" },
      { property: "og:description", content: "Discover your next favorite film. AI-powered movie recommendations, mood matching, watchlists, and a curated cinematic library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "LumoroX AI — Cinematic Movie Recommendations" },
      { name: "twitter:description", content: "Discover your next favorite film. AI-powered movie recommendations, mood matching, watchlists, and a curated cinematic library." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/0a35ce3e-51a2-45df-ab18-8b28a1cb5844" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/0a35ce3e-51a2-45df-ab18-8b28a1cb5844" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://image.tmdb.org", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://image.tmdb.org" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": "https://lumorox.lovable.app/#website",
          name: "LumoroX AI",
          url: "https://lumorox.lovable.app/",
          description:
            "AI-powered movie discovery: reviews, ratings, trailers, synopses and personalized recommendations.",
          inLanguage: "en",
          publisher: {
            "@type": "Organization",
            name: "LumoroX AI",
            url: "https://lumorox.lovable.app/",
          },
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: "https://lumorox.lovable.app/search?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
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
  const isHome = useRouterState({ select: (s) => s.location.pathname === "/" });
  return (
    <QueryClientProvider client={queryClient}>
      <Navbar />
      <div className="flex min-h-dvh flex-col">
        <main className="flex-1 pt-28 md:pt-16">
          <Outlet />
        </main>
        {isHome && (
          <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
            <p>LumoroX AI · Powered by curated cinema & local intelligence</p>
          </footer>
        )}
      </div>

      <Toaster />
    </QueryClientProvider>
  );
}
