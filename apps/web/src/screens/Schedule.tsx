import { useState, useEffect, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Lock,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Navigation,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import PublicNav, { NavSentinel } from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";
import {
  getWeeklySchedule,
  getShopStatus,
  getShopRules,
  type WeeklyScheduleResponse,
  type DaySchedule,
  type ShopRule,
} from "@/lib/api";
import {
  SHOP_LOCATION,
  shopAddressSingleLine,
  shopDirectionsUrl,
  shopOsmUrl,
} from "@/lib/shopLocation";

// Leaflet is heavy (~150KB) and only needed here — keep it out of the
// initial bundle for every other page.
const ShopMap = lazy(() => import("@/components/shop/ShopMap"));

// --- Helpers ---
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Sunday -> -6, Monday -> 0
  return new Date(d.setDate(diff));
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(monday)} - ${fmt(sunday)}, ${monday.getFullYear()}`;
}

function formatSlotTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDayHeader(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// --- Schedule Screen ---
export default function Schedule() {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [schedule, setSchedule] = useState<WeeklyScheduleResponse | null>(null);
  const [shopStatus, setShopStatus] = useState<{
    is_open: boolean;
    shop_name: string;
  } | null>(null);
  const [rules, setRules] = useState<ShopRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Live clock — tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch shop rules on mount
  useEffect(() => {
    getShopRules()
      .then((r) => setRules(r.sort((a, b) => a.order - b.order)))
      .catch(() => {});
  }, []);

  // Fetch shop status + weekly schedule whenever week or day changes
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const dateStr = formatDateYYYYMMDD(weekStart);
      setLoading(true);
      setError(null);
      try {
        const [shop, sched] = await Promise.all([
          getShopStatus().catch(() => null),
          getWeeklySchedule(dateStr),
        ]);
        if (cancelled) return;
        if (shop) setShopStatus(shop);
        setSchedule(sched);
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load schedule");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  function handleSlotClick(slotTime: string, dayDate: string) {
    // Navigate to /book with pre-filled params
    navigate(`/book?date=${dayDate}&time=${slotTime}`);
  }

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(getMonday(d));
    setSelectedDay(null);
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(getMonday(d));
    setSelectedDay(null);
  }

  const days: DaySchedule[] = schedule?.days ?? [];
  const isShopOpen = shopStatus?.is_open ?? true;

  // --- Derived: currently selected day for mobile ---
  const mobileDay = selectedDay
    ? (days.find((d) => d.date === selectedDay) ?? days[0])
    : days[0];

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <PublicNav />
      <NavSentinel />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-24 pb-16">
        {/* Header — shop name + live clock */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-orange-500 uppercase">
              Live availability
            </p>
            <h1 className="font-display mt-1 text-3xl tracking-wide uppercase sm:text-4xl">
              {shopStatus?.shop_name ?? "Kabarbers"}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Weekly schedule. See what is available and book your slot.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-200">
              <Clock className="w-4 h-4 text-zinc-500" />
              {now.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            <span className="text-xs text-zinc-500">
              {now.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        </div>

        {/* Shop closed banner */}
        {!isShopOpen && (
          <Card className="border-red-900/60 bg-red-950/50">
            <CardContent className="flex items-center gap-3 py-4">
              <Lock className="w-6 h-6 text-red-400 shrink-0" />
              <div>
                <p className="font-semibold text-red-200">
                  Shop is currently closed
                </p>
                <p className="text-sm text-red-300/80">
                  We are not accepting new bookings at this time. Existing
                  appointments are still honored.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Week navigation */}
        <Card className="border-white/10 bg-zinc-900/80">
          <CardContent className="flex items-center justify-between py-3">
            <Button
              variant="outline"
              size="icon"
              onClick={prevWeek}
              aria-label="Previous week"
              className="border-white/15 bg-transparent text-zinc-200 hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <p className="font-medium text-sm text-white">
                {formatWeekRange(weekStart)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-5 mt-0.5 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                onClick={() => {
                  const d = getMonday(new Date());
                  setWeekStart(d);
                  setSelectedDay(null);
                }}
              >
                Go to today
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={nextWeek}
              aria-label="Next week"
              className="border-white/15 bg-transparent text-zinc-200 hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Error banner */}
        {error && (
          <div className="bg-red-950/60 border border-red-900/60 rounded-md px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <Card className="border-white/10 bg-zinc-900/80">
            <CardContent className="py-8 text-center text-sm text-zinc-400">
              Loading schedule...
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!loading && days.length === 0 && (
          <Card className="border-white/10 bg-zinc-900/80">
            <CardContent className="py-8 text-center text-sm text-zinc-400">
              No schedule available. The shop has no active services configured.
            </CardContent>
          </Card>
        )}

        {/* Weekly grid — desktop */}
        {!loading && days.length > 0 && (
          <>
            {/* Desktop grid: 7 columns */}
            <div className="hidden md:grid grid-cols-7 gap-3">
              {days.map((day) => (
                <Card key={day.date} className="flex flex-col border-white/10 bg-zinc-900/80">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-xs font-semibold text-center text-zinc-200">
                      {formatDayHeader(day.date)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 pt-0 space-y-1.5">
                    {day.slots.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-4">
                        Closed
                      </p>
                    ) : (
                      day.slots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => {
                            if (slot.status === "available" && isShopOpen)
                              handleSlotClick(slot.time, day.date);
                          }}
                          disabled={slot.status !== "available" || !isShopOpen}
                          className={`w-full text-xs font-medium rounded-md px-2 py-1.5 text-center transition-colors
                            ${
                              !isShopOpen
                                ? "bg-white/5 text-zinc-600 border border-white/10 cursor-not-allowed"
                                : slot.status === "available"
                                  ? "bg-orange-500/10 text-orange-200 border border-orange-500/30 hover:bg-orange-500/25 hover:border-orange-500/60 cursor-pointer"
                                  : "bg-white/[0.03] text-zinc-600 border border-white/5 cursor-not-allowed"
                            }
                          `}
                        >
                          {formatSlotTime(slot.time)}
                          <Badge
                            variant="outline"
                            className={`ml-1 text-[10px] h-3 px-1 border-0 ${
                              slot.status === "available"
                                ? "bg-orange-500/20 text-orange-300"
                                : "bg-white/5 text-zinc-600"
                            }`}
                          >
                            {slot.status === "available" ? "free" : "booked"}
                          </Badge>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Mobile: day tabs */}
            <div className="md:hidden space-y-3">
              <div className="flex gap-1 overflow-x-auto pb-1">
                {days.map((day) => (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDay(day.date)}
                    className={`shrink-0 min-h-11 rounded-lg border px-3 py-2 text-xs font-medium transition-colors
                      ${
                        (selectedDay ?? days[0]?.date) === day.date
                          ? "bg-accent-deep text-white border-accent-deep"
                          : "bg-zinc-900 border-white/10 text-zinc-300"
                      }
                    `}
                  >
                    {formatDayHeader(day.date)}
                    {day.slots.length > 0 && (
                      <span className="ml-1 text-[10px] opacity-70">
                        ({day.slots.length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {mobileDay && (
                <Card className="border-white/10 bg-zinc-900/80">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm text-white">
                      {formatDayHeader(mobileDay.date)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {mobileDay.slots.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-4">
                        Closed today
                      </p>
                    ) : (
                      mobileDay.slots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => {
                            if (slot.status === "available" && isShopOpen)
                              handleSlotClick(slot.time, mobileDay.date);
                          }}
                          disabled={slot.status !== "available" || !isShopOpen}
                          className={`w-full min-h-11 text-xs font-medium rounded-md px-3 py-2 flex items-center justify-between transition-colors
                            ${
                              !isShopOpen
                                ? "bg-white/5 text-zinc-600 border border-white/10"
                                : slot.status === "available"
                                  ? "bg-orange-500/10 text-orange-100 border border-orange-500/30 hover:bg-orange-500/25"
                                  : "bg-white/[0.03] text-zinc-600 border border-white/5"
                            }
                          `}
                        >
                          <span>{formatSlotTime(slot.time)}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] border-0 ${
                              slot.status === "available"
                                ? "bg-orange-500/20 text-orange-300"
                                : "bg-white/5 text-zinc-600"
                            }`}
                          >
                            {slot.status === "available"
                              ? "available"
                              : "booked"}
                          </Badge>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        {/* Find us */}
        <Card className="overflow-hidden border-white/10 bg-zinc-900/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <MapPin className="h-4 w-4 text-orange-400" aria-hidden="true" />
              Find us
            </CardTitle>
          </CardHeader>
          <Suspense
            fallback={
              <div
                className="h-64 w-full animate-pulse bg-muted motion-reduce:animate-none sm:h-80"
                aria-label="Loading map"
                role="status"
              />
            }
          >
            <ShopMap />
          </Suspense>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2 text-sm">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium text-white">{SHOP_LOCATION.name}</p>
                <p className="text-zinc-400">
                  {shopAddressSingleLine()}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-accent-deep font-semibold text-white hover:bg-orange-500"
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
                size="sm"
                variant="outline"
                className="border-white/15 bg-transparent text-zinc-200 hover:bg-white/10 hover:text-white"
                render={
                  <a
                    href={shopOsmUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                View larger map
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Shop rules */}
        {rules.length > 0 && (
          <Card className="border-white/10 bg-zinc-900/80">
            <CardHeader>
              <CardTitle className="text-sm text-white">Shop Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1.5 list-decimal list-inside text-sm text-zinc-300">
                {rules.map((rule) => (
                  <li key={rule.id}>
                    <span className="font-semibold text-white">{rule.title}</span>:{" "}
                    {rule.text}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {!loading && days.length > 0 && (
          <>
            <Separator className="bg-white/10" />
            <div className="flex justify-center pb-4">
              <Button
                onClick={() => navigate("/book")}
                size="lg"
                className="bg-accent-deep px-10 font-bold whitespace-nowrap text-white hover:bg-orange-500"
              >
                Book Appointment
              </Button>
            </div>
          </>
        )}
      </div>
      <PublicFooter />
    </div>
  );
}
