import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Film, Search, Heart, Sparkles, Smile, Sun, Moon, Wand2, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const links = [
  { to: "/", label: "Home", icon: Film },
  { to: "/search", label: "Search", icon: Search },
  { to: "/ask", label: "Ask AI", icon: Wand2 },
  { to: "/recommendations", label: "For You", icon: Sparkles },
  { to: "/mood", label: "Mood", icon: Smile },
  { to: "/watchlist", label: "Watchlist", icon: Heart },
] as const;

export function Navbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [scrolled, setScrolled] = useState(false);
  const [light, setLight] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const saved = localStorage.getItem("lumorox-theme");
    const isLight = saved === "light";
    setLight(isLight);
    document.documentElement.classList.toggle("light", isLight);
  }, []);

  const toggleTheme = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    localStorage.setItem("lumorox-theme", next ? "light" : "dark");
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "glass border-b border-border" : "bg-gradient-to-b from-black/70 to-transparent",
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md brand-gradient shadow-[var(--shadow-glow)]">
            <Film className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-2xl tracking-[0.15em] text-foreground">
            LUMORO<span className="text-brand">X</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname === l.to || (l.to !== "/" && pathname.startsWith(l.to));
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/search"
            aria-label="Search"
            className="grid h-9 w-9 place-items-center rounded-full text-foreground hover:bg-accent md:hidden"
          >
            <Search className="h-5 w-5" />
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="grid h-9 w-9 place-items-center rounded-full text-foreground hover:bg-accent"
          >
            {light ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <nav aria-label="Mobile" className="container mx-auto flex gap-1 overflow-x-auto px-3 pb-2 scroll-row md:hidden">
        {links.map((l) => {
          const active = pathname === l.to || (l.to !== "/" && pathname.startsWith(l.to));
          const Icon = l.icon;
          return (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-brand text-brand-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
