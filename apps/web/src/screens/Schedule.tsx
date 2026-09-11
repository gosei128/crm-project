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
  return `${fmt(monday)} – ${fmt(sunday)}, ${monday.getFullYear()}`;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex justify-center pt-8 px-4 pb-16">
      <div className="w-full max-w-6xl space-y-6">
        {/* Header — shop name + live clock */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Button variant="link" onClick={() => navigate("/customer")}>
                <ChevronLeft className="w-6 h-6 text-primary" />
              </Button>
              {shopStatus?.shop_name ?? "Kabarbers"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Weekly schedule — see what&apos;s available and book your slot
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Clock className="w-4 h-4 text-muted-foreground" />
              {now.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            <span className="text-xs text-muted-foreground">
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
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 py-4">
              <Lock className="w-6 h-6 text-red-600 shrink-0" />
              <div>
                <p className="font-semibold text-red-700">
                  Shop is currently closed
                </p>
                <p className="text-sm text-red-600">
                  We are not accepting new bookings at this time. Existing
                  appointments are still honored.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Week navigation */}
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <Button
              variant="outline"
              size="icon"
              onClick={prevWeek}
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <p className="font-medium text-sm">
                {formatWeekRange(weekStart)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-5 mt-0.5"
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
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Loading schedule...
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!loading && days.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
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
                <Card key={day.date} className="flex flex-col">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-xs font-semibold text-center">
                      {formatDayHeader(day.date)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 pt-0 space-y-1.5">
                    {day.slots.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
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
                                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                : slot.status === "available"
                                  ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 cursor-pointer"
                                  : "bg-red-50 text-red-700 border border-red-200 cursor-not-allowed"
                            }
                          `}
                        >
                          {formatSlotTime(slot.time)}
                          <Badge
                            variant="outline"
                            className={`ml-1 text-[10px] h-3 px-1 border-0 ${
                              slot.status === "available"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
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
                    className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-colors
                      ${
                        (selectedDay ?? days[0]?.date) === day.date
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-foreground"
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
                <Card>
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm">
                      {formatDayHeader(mobileDay.date)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {mobileDay.slots.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Closed — no availability
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
                          className={`w-full text-xs font-medium rounded-md px-3 py-2 flex items-center justify-between transition-colors
                            ${
                              !isShopOpen
                                ? "bg-slate-100 text-slate-400 border border-slate-200"
                                : slot.status === "available"
                                  ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                                  : "bg-red-50 text-red-700 border border-red-200"
                            }
                          `}
                        >
                          <span>{formatSlotTime(slot.time)}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] border-0 ${
                              slot.status === "available"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
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
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
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
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">{SHOP_LOCATION.name}</p>
                <p className="text-muted-foreground">
                  {shopAddressSingleLine()}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
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
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Shop Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1.5 list-decimal list-inside text-sm text-slate-700">
                {rules.map((rule) => (
                  <li key={rule.id}>
                    <span className="font-semibold text-slate-900">{rule.title}</span>{" "}
                    — {rule.text}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {!loading && days.length > 0 && (
          <>
            <Separator />
            <div className="flex justify-center">
              <Button onClick={() => navigate("/book")} size="lg">
                Book Now
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
