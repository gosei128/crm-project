import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  CalendarCheck,
  ChevronDown,
  MapPin,
  Navigation,
  QrCode,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import PublicNav, { NavSentinel } from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";
import Hero from "@/screens/Hero";
import { Button } from "@/components/ui/button";
import {
  getShopRules,
  getShopStatus,
  getSingletonService,
  getWeeklySchedule,
  type DaySchedule,
  type ShopRule,
} from "@/lib/api";
import {
  SHOP_LOCATION,
  shopAddressSingleLine,
  shopDirectionsUrl,
  shopOsmUrl,
} from "@/lib/shopLocation";
import { HERO_FALLBACK_IMAGE } from "@/config/site";
import HeroImage from "../assets/images/kabarbers.jpg";

import { GALLERY_IMAGES } from "@/config/gallery";
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

  // Buttery smooth scrolling, landing only. Destroyed on unmount so the
  // booking and dashboard pages keep native scroll.
  useEffect(() => initLenis(), []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoadingPreview(true);
      const monday = toYMD(getMonday(new Date()));
      const [shop, svc, sched, shopRules] = await Promise.allSettled([
        getShopStatus(),
        getSingletonService(),
        getWeeklySchedule(monday),
        getShopRules(),
      ]);
      if (cancelled) return;
      if (shop.status === "fulfilled") {
        setShopOpen(shop.value.is_open);
        setShopName(shop.value.shop_name || "Kabarbers");
      }
      if (svc.status === "fulfilled") {
        setServiceName(svc.value.name || "Haircut");
        setDurationMin(svc.value.duration_minutes || 30);
      }
      if (sched.status === "fulfilled") setDays(sched.value.days);
      if (shopRules.status === "fulfilled") setRules(shopRules.value);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <PublicNav />
      <NavSentinel />
      <main className="pb-20 md:pb-0">
        <Hero shopOpen={shopOpen} freeToday={freeToday} />

        {/* Craft band: full-bleed photo, functional caption below */}
        <section aria-label="Inside the shop">
          <div className="overflow-hidden border-y border-white/10">
            <img
              src={HERO_FALLBACK_IMAGE}
              alt="Inside Kabarbers barbershop in Malolos"
              loading="lazy"
              className="h-64 w-full object-cover object-center sm:h-96"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <p className="mx-auto w-full max-w-6xl px-4 pt-3 pb-10 text-sm text-zinc-500">
            Inside the shop on Sampaguita St, Malolos.
          </p>
        </section>

        {/* Work showcase: owner cuts, images swapped in via config */}
        <section
          aria-label="Recent cuts"
          className="reveal mx-auto w-full max-w-6xl px-4 py-14"
        >
          <h2 className="font-display max-w-xl text-4xl tracking-wide uppercase sm:text-5xl">
            Fresh from the chair
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
            Recent cuts from the shop. New photos land here after every busy
            week.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {GALLERY_IMAGES.map((photo, i) => (
              <li
                key={photo.src}
                className={i === 0 ? "col-span-2 md:row-span-2" : undefined}
              >
                <figure className="group h-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    className={
                      i === 0
                        ? "aspect-[16/10] h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03] md:aspect-auto"
                        : "aspect-[4/5] h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                    }
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </figure>
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
                <span className="block text-orange-500">Full routine.</span>
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-zinc-400">
                {serviceName}, {durationMin} minutes shaped to your head, never
                rushed between chairs.
              </p>
              <Link
                to="/book"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-accent-deep px-7 text-sm font-bold whitespace-nowrap text-white transition-all hover:bg-orange-500 active:scale-[0.98]"
              >
                Book Appointment
              </Link>
            </div>
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {visitRows.map((row) => (
                <li
                  key={row.title}
                  className="grid grid-cols-[auto_1fr] gap-4 py-5"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                    <row.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-white">
                      {row.title}
                    </span>
                    <span className="mt-1 block max-w-md text-sm leading-relaxed text-zinc-400">
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
          className="reveal border-y border-white/10 bg-zinc-900/40"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-14">
            <h2 className="font-display max-w-xl text-4xl tracking-wide uppercase sm:text-5xl">
              Three moves to the chair
            </h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
              {moves.map((move) => (
                <li
                  key={move.title}
                  className="relative border-l-2 border-orange-500/60 pl-6"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-950 text-orange-400">
                    <move.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold text-white">
                    {move.title}
                  </h3>
                  <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-zinc-400">
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
              <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
                Live from the shop book. Times update as chairs fill.
              </p>
            </div>
            <Link
              to="/schedule"
              className="rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-orange-400 hover:text-orange-300 hover:underline"
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
                  className="h-44 animate-pulse rounded-2xl border border-white/10 bg-zinc-900"
                />
              ))}
            </div>
          ) : previewDays.length === 0 ? (
            <p className="mt-8 rounded-2xl border border-white/10 bg-zinc-900 p-6 text-sm text-zinc-400">
              No schedule published yet. Check back soon.
            </p>
          ) : (
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {previewDays.map((d) => {
                const free = d.slots.filter((s) => s.status === "available");
                return (
                  <article
                    key={d.date}
                    className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        to={`/book?date=${d.date}`}
                        className="font-semibold whitespace-nowrap text-white hover:text-orange-300 hover:underline"
                      >
                        {dayLabel(d.date)}
                      </Link>
                      <span className="text-xs font-medium whitespace-nowrap text-zinc-500 tabular-nums">
                        {free.length === 0
                          ? "Fully booked"
                          : `${free.length} open`}
                      </span>
                    </div>
                    {free.length === 0 ? (
                      <p className="mt-3 text-sm text-zinc-500">
                        Try another day.
                      </p>
                    ) : (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {free.slice(0, 6).map((s) => (
                          <li key={s.time}>
                            <Link
                              to={`/book?date=${d.date}&time=${encodeURIComponent(s.time)}`}
                              className="inline-block min-h-9 rounded-xl border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-orange-100 tabular-nums transition-colors hover:bg-orange-500/25"
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
            className="reveal border-y border-white/10 bg-zinc-900/40"
          >
            <div className="mx-auto w-full max-w-6xl px-4 py-14">
              <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
                House rules
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
                Agreed again at booking. Short version: deposits lock chairs,
                lateness loses them.
              </p>
              <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
                {rules.map((rule, i) => (
                  <details
                    key={rule.id}
                    open={i === 0}
                    className="group border-b border-white/10 bg-zinc-950 last:border-0"
                  >
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
                      {rule.title}
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="max-w-2xl px-5 pb-5 text-sm leading-relaxed text-zinc-400">
                      {rule.text}
                    </p>
                  </details>
                ))}
              </div>
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
            {shopName} <span className="text-orange-500">in Malolos</span>
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="min-h-64 overflow-hidden rounded-2xl border border-white/10">
              <Suspense
                fallback={
                  <div
                    className="h-64 w-full animate-pulse bg-zinc-900 sm:h-80"
                    role="status"
                    aria-label="Loading map"
                  />
                }
              >
                <ShopMap />
              </Suspense>
            </div>
            <div className="flex flex-col justify-between gap-6 rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
              <div>
                <p className="flex items-start gap-2 text-sm">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-orange-400"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-semibold text-white">
                      {SHOP_LOCATION.name}
                    </span>
                    <span className="mt-1 block text-zinc-400">
                      {shopAddressSingleLine()}
                    </span>
                  </span>
                </p>
                <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
                  Strictly by appointment. Book before you travel so the chair
                  is ready.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-accent-deep font-semibold whitespace-nowrap text-white hover:bg-orange-500"
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
                  className="border-white/15 bg-transparent whitespace-nowrap text-white hover:bg-white/10 hover:text-white"
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
          <div className="reveal relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-700 to-orange-500 p-8 sm:p-12">
            <Scissors
              aria-hidden="true"
              className="absolute -right-6 -bottom-6 h-48 w-48 rotate-12 text-black/10"
            />
            <h2 className="font-display max-w-lg text-4xl tracking-wide text-white uppercase sm:text-5xl">
              Your chair is waiting
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-orange-50">
              Chairs go to whoever pays first. Do not watch Saturday disappear.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/book"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-zinc-950 px-8 text-sm font-bold whitespace-nowrap text-white hover:bg-black"
              >
                Book Appointment
              </Link>
              <Link
                to="/schedule"
                className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold whitespace-nowrap text-white hover:underline"
              >
                Schedule
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Sticky mobile booking bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur md:hidden">
        <Link
          to="/book"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent-deep text-sm font-bold whitespace-nowrap text-white active:scale-[0.99]"
        >
          <CalendarCheck className="h-4 w-4" aria-hidden="true" />
          Book Appointment
        </Link>
      </div>

      <PublicFooter />
    </div>
  );
}
