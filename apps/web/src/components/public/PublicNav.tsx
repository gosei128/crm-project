import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Scissors, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/authContext";
import { scrollToSection } from "@/lib/lenis";

const LINKS = [
  { to: "/schedule", label: "Schedule" },
  { to: "/book", label: "Book" },
];

/**
 * Zero-height marker placed at the very top of each public page (right after
 * `<PublicNav />`). The nav observes it to switch from transparent to solid.
 */
export function NavSentinel() {
  return (
    <div
      id="nav-sentinel"
      aria-hidden="true"
      className="absolute inset-x-0 top-0 h-px"
    />
  );
}

export default function PublicNav() {
  // First paint matches the load scroll position; the observer below takes
  // over from there (lazy init keeps setState out of the effect body).
  const [scrolled, setScrolled] = useState(
    () => typeof window !== "undefined" && window.scrollY > 24,
  );
  const [open, setOpen] = useState(false);
  const isOwner = useAuth().user?.role === "owner";
  const location = useLocation();
  const navigate = useNavigate();

  // Solid background once the page scrolls past the top sentinel.
  // IntersectionObserver, never a scroll listener (jank-free by design).
  useEffect(() => {
    const sentinel = document.getElementById("nav-sentinel");
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [location.pathname]);

  // Mobile menu closes via onClick on each link (no set-state-in-effect).

  function handleFindUs(e: ReactMouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
      // Landing needs a beat to mount (and start Lenis) before scrolling.
      window.setTimeout(() => scrollToSection("find-us"), 350);
    } else {
      scrollToSection("find-us");
    }
  }

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-200",
        scrolled || open
          ? "border-b border-white/10 bg-zinc-950/90 backdrop-blur"
          : "border-b border-transparent bg-gradient-to-b from-black/70 to-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4"
      >
        <button
          type="button"
          onClick={() => void navigate("/")}
          className="flex min-h-11 items-center gap-2.5 rounded-lg text-left text-white"
          aria-label="Kabarbers home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">
            <Scissors className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="font-display block text-lg tracking-wide uppercase">
              Kabarbers
            </span>
            <span className="block text-[11px] text-zinc-400">
              Malolos · By appointment
            </span>
          </span>
        </button>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
          <a
            href="#find-us"
            onClick={handleFindUs}
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Find Us
          </a>
          {isOwner ? (
            <Link
              to="/dashboard"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Dashboard
            </Link>
          ) : null}
          <Link
            to="/book"
            className="ml-2 inline-flex min-h-11 items-center rounded-xl bg-accent-deep px-5 text-sm font-semibold whitespace-nowrap text-white shadow-lg shadow-orange-950/40 transition-transform hover:bg-orange-500 active:scale-[0.98]"
          >
            Book Appointment
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10"
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

        {open ? (
        <div className="border-t border-white/10 bg-zinc-950/95 px-4 pt-2 pb-4 backdrop-blur md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block min-h-11 rounded-lg px-3 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10"
            >
              {l.label}
            </Link>
          ))}
          <a
            href="#find-us"
            onClick={handleFindUs}
            className="block min-h-11 rounded-lg px-3 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10"
          >
            Find Us
          </a>
          {isOwner ? (
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="block min-h-11 rounded-lg px-3 py-3 text-sm font-medium text-zinc-200 hover:bg-white/10"
            >
              Dashboard
            </Link>
          ) : null}
          <Link
            to="/book"
            onClick={() => setOpen(false)}
            className="mt-2 flex min-h-12 items-center justify-center rounded-xl bg-accent-deep text-sm font-semibold whitespace-nowrap text-white"
          >
            Book Appointment
          </Link>
        </div>
      ) : null}
    </header>
  );
}
