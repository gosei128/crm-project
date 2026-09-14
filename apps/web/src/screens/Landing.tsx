import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  CalendarCheck,
  MapPin,
  Navigation,
  QrCode,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import PublicNav, { NavSentinel } from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";
import SocialLinks from "@/components/public/SocialLinks";
import Hero from "@/screens/Hero";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import {
  getGallery,
  getShopRules,
  getShopStatus,
  getSingletonService,
  getWeeklySchedule,
  type DaySchedule,
  type GalleryPhoto,
  type ShopRule,
} from "@/lib/api";
import {
  SHOP_LOCATION,
  shopAddressSingleLine,
  shopDirectionsUrl,
  shopOsmUrl,
} from "@/lib/shopLocation";
import { fallbackGallery } from "@/config/gallery";
import { HERO_FALLBACK_IMAGE, resolveHeroImage } from "@/config/site";
import { initLenis } from "@/lib/lenis";

const ShopMap = lazy(() => import("@/components/shop/ShopMap"));

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function slotLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Landing() {
  const [shopOpen, setShopOpen] = useState(true);
  const [shopName, setShopName] = useState("Kabarbers");
  const [serviceName, setServiceName] = useState("Haircut");
  const [durationMin, setDurationMin] = useState(30);
  const [days, setDays] = useState<DaySchedule[]>([]);
  const [rules, setRules] = useState<ShopRule[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [showcase, setShowcase] = useState<GalleryPhoto[]>(() =>
    fallbackGallery(),
  );
  const [heroImage, setHeroImage] = useState<string | null>(null);

  // Buttery smooth scrolling, landing only. Destroyed on unmount so the
  // booking and dashboard pages keep native scroll.
  useEffect(() => initLenis(), []);

  // Fade + slide-up per section as it enters the viewport. Re-scan when
  // the async house-rules section mounts so it reveals too.
  useScrollReveal([rules.length, showcase.length]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoadingPreview(true);
      const monday = toYMD(getMonday(new Date()));
      const [shop, svc, sched, shopRules, gallery] = await Promise.allSettled([
        getShopStatus(),
        getSingletonService(),
        getWeeklySchedule(monday),
        getShopRules(),
        getGallery(),
      ]);
      if (cancelled) return;
      if (shop.status === "fulfilled") {
        setShopOpen(shop.value.is_open);
        setShopName(shop.value.shop_name || "Kabarbers");
        setHeroImage(shop.value.hero_image_url);
      }
      if (svc.status === "fulfilled") {
        setServiceName(svc.value.name || "Haircut");
        setDurationMin(svc.value.duration_minutes || 30);
      }
      if (sched.status === "fulfilled") setDays(sched.value.days);
      if (shopRules.status === "fulfilled") setRules(shopRules.value);
      if (gallery.status === "fulfilled" && gallery.value.length > 0)
        setShowcase(gallery.value);
      setLoadingPreview(false);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayStr = useMemo(() => toYMD(new Date()), []);
  const freeToday = useMemo(() => {
    const today = days.find((d) => d.date === todayStr);
    if (!today) return null;
    return today.slots.filter((s) => s.status === "available").length;
  }, [days, todayStr]);

  const previewDays = useMemo(() => {
    const upcoming = days.filter((d) => d.date >= todayStr).slice(0, 3);
    return upcoming.length > 0 ? upcoming : days.slice(0, 3);
  }, [days, todayStr]);

  const visitRows = [
    {
      icon: CalendarCheck,
      title: "Strictly by appointment",
      text: "Your slot is held for you alone. Arrive, check in, sit down.",
    },
    {
      icon: ShieldCheck,
      title: "Locked with GCash",
      text: "First paid hold wins the chair. No double bookings, ever.",
    },
    {
      icon: Scissors,
      title: "Single craft",
      text: `One haircut done right. ${durationMin} unhurried minutes per visit.`,
    },
  ];

  const moves = [
    {
      icon: CalendarCheck,
      title: "Pick a slot",
      text: "See open times and take one that fits. One booking holds one visit.",
    },
    {
      icon: QrCode,
      title: "Send the proof",
      text: "Pay the downpayment on GCash and upload the receipt. Confirmation follows.",
    },
    {
      icon: BadgeCheck,
      title: "Take your seat",
      text: "Show the booking code at check-in. Late over 15 minutes voids the slot.",
    },
  ];

  return (
    <div className="min-h-screen bg-parchment text-espresso">
      <PublicNav />
      <NavSentinel />
      <main className="pb-20 md:pb-0">
        <Hero shopOpen={shopOpen} freeToday={freeToday} heroImage={heroImage} />

        {/* Craft band: full-bleed photo, functional caption below */}
        <section aria-label="Inside the shop">
          <div className="overflow-hidden border-y border-espresso/10">
            <img
              src={resolveHeroImage(HERO_FALLBACK_IMAGE)}
              alt="Inside Kabarbers barbershop in Malolos"
              loading="lazy"
              className="h-64 w-full object-cover object-center sm:h-96"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <p className="mx-auto w-full max-w-6xl px-4 pt-3 pb-10 text-sm text-espresso/55">
            Inside the shop on Sampaguita St, Malolos.
          </p>
        </section>

        {/* Work showcase: owner-managed via Shop Controls → /gallery */}
        <section
          aria-label="Recent cuts"
          className="reveal mx-auto w-full max-w-6xl px-4 py-14"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display max-w-xl text-4xl tracking-wide uppercase sm:text-5xl">
                Fresh from the chair
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-espresso/65">
                Recent cuts from the shop. New photos land here after every busy
                week.
              </p>
            </div>
            <Link
              to="/gallery"
              className="rounded-xl border border-espresso/20 px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-espresso transition-colors hover:bg-espresso/5"
            >
              View All
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {showcase.slice(0, 5).map((photo, i) => (
              <li
                key={photo.id}
                className={i === 0 ? "col-span-2 md:row-span-2" : undefined}
              >
                <Link
                  to="/gallery"
                  aria-label={`View gallery: ${photo.alt || "showcase photo"}`}
                  className="group block h-full overflow-hidden rounded-2xl border border-espresso/10 bg-cream shadow-[0_2px_12px_-6px_rgb(43_33_24/0.25)]"
                >
                  <img
                    src={photo.image_url}
                    alt={photo.alt || "Barbershop work photo"}
                    loading="lazy"
                    className={
                      i === 0
                        ? "aspect-[16/10] h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03] md:aspect-auto"
                        : "aspect-[4/5] h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                    }
                    onError={(e) => {
                      e.currentTarget.style.opacity = "0.25";
                    }}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* The visit: spec rows beside a service panel */}
        <section
          aria-label="The visit"
          className="reveal mx-auto w-full max-w-6xl px-4 py-14"
        >
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
                One chair.
                <span className="block text-oxblood">Full routine.</span>
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-espresso/65">
                {serviceName}, {durationMin} minutes shaped to your head, never
                rushed between chairs.
              </p>
              <Link
                to="/book"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-accent-deep px-7 text-sm font-bold whitespace-nowrap text-white transition-all hover:bg-oxblood-bright active:scale-[0.98]"
              >
                Book Appointment
              </Link>
            </div>
            <ul className="divide-y divide-espresso/10 border-y border-espresso/10">
              {visitRows.map((row) => (
                <li
                  key={row.title}
                  className="grid grid-cols-[auto_1fr] gap-4 py-5"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brass/15 text-brass-deep">
                    <row.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-espresso">
                      {row.title}
                    </span>
                    <span className="mt-1 block max-w-md text-sm leading-relaxed text-espresso/65">
                      {row.text}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Booking path: railed timeline, verb-led, no numerals */}
        <section
          aria-label="Booking path"
          className="reveal border-y border-espresso/10 bg-cream/70"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-14">
            <h2 className="font-display max-w-xl text-4xl tracking-wide uppercase sm:text-5xl">
              Three moves to the chair
            </h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
              {moves.map((move) => (
                <li
                  key={move.title}
                  className="relative border-l-2 border-brass/70 pl-6"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-tranparent border-brass-bright border text-brass-bright">
                    <move.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold text-espresso">
                    {move.title}
                  </h3>
                  <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-espresso/65">
                    {move.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Open chairs: live day columns */}
        <section
          aria-label="Open chairs"
          className="reveal mx-auto w-full max-w-6xl px-4 py-14"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
                Open chairs
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-espresso/65">
                Live from the shop book. Times update as chairs fill.
              </p>
            </div>
            <Link
              to="/schedule"
              className="rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-oxblood hover:text-brass-deep hover:underline"
            >
              Schedule
            </Link>
          </div>
          {loadingPreview ? (
            <div
              className="mt-8 grid gap-4 md:grid-cols-3"
              aria-label="Loading availability"
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-2xl border border-espresso/10 bg-espresso/10"
                />
              ))}
            </div>
          ) : previewDays.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-espresso/10 bg-cream p-6 text-sm text-espresso/65">
              No schedule published yet. Check back soon.
            </p>
          ) : (
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {previewDays.map((d) => {
                const free = d.slots.filter((s) => s.status === "available");
                return (
                  <article
                    key={d.date}
                    className="rounded-2xl border border-espresso/10 bg-cream p-5 shadow-[0_2px_12px_-6px_rgb(43_33_24/0.25)]"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        to={`/book?date=${d.date}`}
                        className="font-semibold whitespace-nowrap text-espresso hover:text-oxblood hover:underline"
                      >
                        {dayLabel(d.date)}
                      </Link>
                      <span className="text-xs font-medium whitespace-nowrap text-espresso/55 tabular-nums"></span>
                    </div>
                    {free.length === 0 ? (
                      <p className="mt-3 text-sm text-espresso/55">
                        Try another day.
                      </p>
                    ) : (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {free.slice(0, 6).map((s) => (
                          <li key={s.time}>
                            <Link
                              to={`/book?date=${d.date}&time=${encodeURIComponent(s.time)}`}
                              className="inline-block min-h-9 rounded-xl border border-moss/30 bg-brass-bright/10 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-moss tabular-nums transition-colors hover:bg-moss/20"
                            >
                              {slotLabel(s.time)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* House rules: disclosure list */}
        {rules.length > 0 ? (
          <section
            aria-label="House rules"
            className="reveal border-y border-espresso/10 bg-cream/70"
          >
            <div className="mx-auto w-full max-w-6xl px-4 py-14">
              <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
                House rules
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-espresso/65">
                Agreed again at booking. Short version: deposits lock chairs,
                lateness loses them.
              </p>
              <Accordion
                type="multiple"
                defaultValue={rules[0] ? [`rule-${rules[0].id}`] : []}
                className="mt-8 overflow-hidden rounded-2xl border border-espresso/10"
              >
                {rules.map((rule) => (
                  <AccordionItem key={rule.id} value={`rule-${rule.id}`}>
                    <AccordionTrigger>{rule.title}</AccordionTrigger>
                    <AccordionContent>{rule.text}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>
        ) : null}

        {/* Location: map plus address block */}
        <section
          id="find-us"
          aria-label="Find us"
          className="reveal mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14"
        >
          <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
            {shopName} <span className="text-oxblood">in Malolos</span>
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="min-h-64 overflow-hidden rounded-2xl border border-espresso/10">
              <Suspense
                fallback={
                  <div
                    className="h-64 w-full animate-pulse bg-espresso/10 sm:h-80"
                    role="status"
                    aria-label="Loading map"
                  />
                }
              >
                <ShopMap />
              </Suspense>
            </div>
            <div className="flex flex-col justify-between gap-6 rounded-2xl border border-espresso/10 bg-cream p-6 shadow-[0_2px_12px_-6px_rgb(43_33_24/0.25)]">
              <div>
                <p className="flex items-start gap-2 text-sm">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-brass-deep"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-semibold text-accent">
                      {SHOP_LOCATION.name}
                    </span>
                    <span className="mt-1 block text-espresso/65">
                      {shopAddressSingleLine()}
                    </span>
                  </span>
                </p>
                <p className="mt-4 max-w-xs text-sm leading-relaxed text-espresso/55">
                  Strictly by appointment. Book before you travel so the chair
                  is ready.
                </p>
                <div className="mt-4">
                  <p className="text-xs font-semibold tracking-wide text-espresso/60 uppercase">
                    Follow the shop
                  </p>
                  <SocialLinks
                    className="mt-2 [&_a]:bg-espresso/10 [&_a]:text-espresso [&_a]:hover:bg-brass/25 [&_a]:hover:text-brass-deep"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-accent-deep font-semibold whitespace-nowrap text-white hover:bg-oxblood-bright"
                  render={
                    <a
                      href={shopDirectionsUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                  Get Directions
                </Button>
                <Button
                  variant="outline"
                  className="border-espresso/20 bg-transparent whitespace-nowrap text-espresso hover:bg-espresso/5 hover:text-espresso"
                  render={
                    <a
                      href={shopOsmUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  Larger map
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA: one panel, one intent */}
        <section
          aria-label="Book now"
          className="mx-auto w-full max-w-6xl px-4 pb-16"
        >
          <div className="reveal relative overflow-hidden rounded-2xl bg-oxblood p-8  sm:p-12">
            <Scissors
              aria-hidden="true"
              className="absolute -right-6 -bottom-6 h-48 w-48 rotate-12 text-cream/15"
            />
            <h2 className="font-display max-w-lg text-4xl tracking-wide text-cream uppercase sm:text-5xl">
              Your chair is waiting
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-cream/85">
              Chairs go to whoever pays first. Do not watch Saturday disappear.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/book"
                className="z-10 inline-flex min-h-12 items-center justify-center rounded-xl bg-night px-8 text-sm font-bold whitespace-nowrap text-cream-ink hover:bg-espresso"
              >
                Book Appointment
              </Link>
              <Link
                to="/schedule"
                className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold whitespace-nowrap text-cream hover:underline"
              >
                Schedule
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Sticky mobile booking bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-ink/10 bg-night/95 px-4 py-3 backdrop-blur md:hidden">
        <Link
          to="/book"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent-deep text-sm font-bold whitespace-nowrap text-cream-ink active:scale-[0.99]"
        >
          <CalendarCheck className="h-4 w-4" aria-hidden="true" />
          Book Appointment
        </Link>
      </div>

      <PublicFooter />
    </div>
  );
}
