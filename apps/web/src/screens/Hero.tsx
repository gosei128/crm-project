import { Link } from "react-router-dom";
import { CalendarCheck } from "lucide-react";
import { getHeroImage, HERO_COPY, HERO_IMAGE_ALT } from "@/config/site";
import HeroLogo from "../assets/images/kabarbers-logo.jpg";

/**
 * Centered full-bleed photo hero (reference: dark filtered barbershop photo,
 * centered welcome copy, single orange CTA). The photo is darkened with a
 * flat overlay plus a bottom blend into the page. Four elements max:
 * eyebrow, brand headline, CTA, live status line.
 * Image source lives in `src/config/site.ts` (see getHeroImage).
 */
export default function Hero({
  shopOpen,
  freeToday,
}: {
  shopOpen: boolean;
  freeToday: number | null;
}) {
  return (
    <section
      aria-label="Kabarbers barbershop"
      className="relative h-full isolate overflow-hidden bg-night"
    >
      {/* Background photo with dark filter */}
      <div
        className="absolute h-full flex justify-center inset-0 -z-10 bg-night-soft"
        aria-hidden="true"
      >
        <img
          src={getHeroImage()}
          alt=""
          role="presentation"
          fetchPriority="high"
          className="h-11/12 self-center w-full object-cover object-center brightness-[0.55] saturate-[0.85]"
          onError={(e) => {
            // Remote image failed (offline/blocked). Hide it so the flat
            // base plus bottom blend carry the hero, no broken icon.
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-night/45" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-night to-transparent" />
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-night to-transparent" />
      </div>
      {/* Screen-reader description of the decorative photo */}
      <span className="sr-only">{HERO_IMAGE_ALT}</span>

      <div className="mx-auto grid min-h-[100svh] w-full max-w-6xl place-items-center px-4 pt-16 pb-16 text-center">
        <div className="min-w-0">
          <img
            src={HeroLogo}
            alt="Kabarbers logo"
            role="presentation"
            fetchPriority="low"
            className="mx-auto w-35 lg:w-50 rounded-full mb-4 ring-2 ring-brass-bright/60 "
            onError={(e) => {
              // Remote image failed (offline/blocked). Hide it so the flat
              // base plus bottom blend carry the hero, no broken icon.
              e.currentTarget.style.display = "none";
            }}
          />
          <p className="animate-enter font-script text-3xl text-brass-bright">
            {HERO_COPY.eyebrow}
          </p>

          <h1 className="animate-enter-1 font-display mt-3 text-6xl leading-[0.95] tracking-wide text-cream-ink uppercase md:text-8xl">
            {HERO_COPY.titleBrand}
          </h1>
          <div
            className="animate-enter-1 mx-auto mt-5 h-px w-28 bg-brass-bright/70"
            aria-hidden="true"
          />

          <div className="animate-enter-2 mt-8 flex justify-center">
            <Link
              to="/book"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent-deep px-8 text-base font-bold whitespace-nowrap text-cream-ink shadow-[0_12px_30px_-10px_rgb(127_29_34/0.7)] transition-all hover:bg-oxblood-bright active:scale-[0.98]"
            >
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
              {HERO_COPY.primaryCta}
            </Link>
          </div>

          <p
            className="animate-enter-3 mt-5 text-sm font-medium text-sand-muted"
            role="status"
          >
            {shopOpen
              ? typeof freeToday === "number"
                ? freeToday === 0
                  ? "Open today. Today is fully booked"
                  : `Open today. ${freeToday} chairs left`
                : "Open today in Malolos"
              : HERO_COPY.statusClosed}
          </p>
        </div>
      </div>
    </section>
  );
}
