import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Scissors, LogOut, Clock, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getMyBookings,
  getServices,
  getShopStatus,
  getCurrentUser,
  getWeeklySchedule,
  type Booking,
  type Service,
  type DaySchedule,
} from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import PaymentProofDialog from "@/components/booking/PaymentProofDialog";

/* ---------- helpers ---------- */

function formatSlot(slot: string) {
  return new Date(slot).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatSlotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatSlotRange(slotStart: string, durationMinutes?: number) {
  const start = new Date(slotStart);
  const end = durationMinutes ? new Date(start.getTime() + durationMinutes * 60000) : null;
  const fmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    booked: "bg-blue-100 text-blue-800 border-blue-200",
    complete: "bg-green-100 text-green-800 border-green-200",
    expired: "bg-gray-100 text-gray-500 border-gray-300",
    cancelled_no_show: "bg-red-100 text-red-700 border-red-200",
    cancelled_late: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {status.replace("_", " ").toUpperCase()}
    </span>
  );
}

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "booked", label: "Booked" },
  { value: "complete", label: "Completed" },
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(monday)} – ${fmt(sunday)}, ${monday.getFullYear()}`;
}
function formatDayHeader(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function isToday(dateStr: string): boolean {
  return dateStr === formatDateYYYYMMDD(new Date());
}

/* ---------- component ---------- */

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [shopOpen, setShopOpen] = useState(true);
  const [userName, setUserName] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Google-style weekly schedule
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [weekSchedule, setWeekSchedule] = useState<DaySchedule[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [proofBooking, setProofBooking] = useState<Booking | null>(null);

  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s.name]));
  const singletonDuration = services[0]?.duration_minutes ?? 30;

  /* --- fetch data on mount --- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [user, bookingsList, svcList, shop] = await Promise.allSettled([
          getCurrentUser(),
          getMyBookings(),
          getServices(),
          getShopStatus(),
        ]);

        if (cancelled) return;

        if (user.status === "fulfilled" && user.value) setUserName(user.value.name);
        if (bookingsList.status === "fulfilled") setBookings(bookingsList.value);
        if (svcList.status === "fulfilled") setServices(svcList.value);
        if (shop.status === "fulfilled") setShopOpen(shop.value.is_open);

        // Surface first meaningful error
        const firstError = [bookingsList, svcList, shop].find((r) => r.status === "rejected");
        if (firstError && firstError.status === "rejected")
          setError(firstError.reason?.message ?? "Failed to load data");
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  /* --- fetch weekly schedule (Google-like) --- */
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const dateStr = formatDateYYYYMMDD(weekStart);
      setScheduleLoading(true);
      try {
        const res = await getWeeklySchedule(dateStr);
        if (!cancelled) setWeekSchedule(res.days);
      } catch {
        if (!cancelled) setWeekSchedule([]);
      } finally {
        if (!cancelled) setScheduleLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

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

  /* --- derived --- */
  const upcoming = bookings.filter(
    (b) => b.status === "booked" || b.status === "pending",
  );
  const nextBooking = upcoming
    .filter((b) => new Date(b.slot_start) > new Date())
    .sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime())[0];

  const filteredBookings =
    statusFilter === "all"
      ? bookings
      : bookings.filter((b) => b.status === statusFilter);

  const mobileDay = selectedDay ? weekSchedule.find((d) => d.date === selectedDay) ?? weekSchedule[0] : weekSchedule[0];

  /* --- handlers --- */
  function handleLogout() {
    logout();
    navigate("/");
  }

  function handleSlotClick(slotTime: string, dayDate: string) {
    navigate(`/book?date=${dayDate}&time=${slotTime}`);
  }

  function handleProofSaved(updated: Booking) {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setProofBooking(null);
  }

  /* --- render --- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex justify-center pt-8 px-4 pb-16">
      <div className="w-full max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Scissors className="w-6 h-6 text-primary" />
              {userName ? `Hi, ${userName}` : "My Bookings"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {shopOpen ? "Shop is open — book your appointment" : "Shop is currently closed"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/schedule")}>
              <Calendar className="w-4 h-4 mr-1.5" />
              Schedule
            </Button>
            <Button size="sm" onClick={() => navigate("/book")} disabled={!shopOpen}>
              Book Now
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Shop-closed banner */}
        {!shopOpen && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-3 text-sm text-red-700">
              The shop is currently closed. Existing bookings are still honored, but no new bookings can be made.
            </CardContent>
          </Card>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold">{bookings.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{upcoming.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-green-700">
                {bookings.filter((b) => b.status === "complete").length}
              </p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Google-style Weekly Timeline — Booked vs Available */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Weekly Timeline
                <span className="text-xs font-normal text-muted-foreground hidden sm:inline">— like Google Calendar</span>
              </CardTitle>
              <Badge variant="outline" className="text-[11px] font-normal">
                {scheduleLoading ? "Loading…" : `${weekSchedule.reduce((a, d) => a + d.slots.filter((s) => s.status === "available").length, 0)} free · ${weekSchedule.reduce((a, d) => a + d.slots.filter((s) => s.status === "booked").length, 0)} booked`}
              </Badge>
            </div>
            <div className="flex items-center justify-between mt-3">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={prevWeek} aria-label="Previous week">
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <div className="text-center">
                <p className="text-xs font-medium">{formatWeekRange(weekStart)}</p>
                <button onClick={() => { setWeekStart(getMonday(new Date())); setSelectedDay(null); }} className="text-[11px] text-primary hover:underline">Today</button>
              </div>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={nextWeek} aria-label="Next week">
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            {/* legend like Google */}
            <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Booked</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" /> Closed</span>
              <span className="ml-auto hidden sm:inline text-[10px]">Tap a green time to book</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {scheduleLoading ? (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    <div className="h-20 bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : weekSchedule.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No schedule available.</p>
            ) : (
              <>
                {/* Desktop: Google Calendar 7-col grid */}
                <div className="hidden md:grid grid-cols-7 gap-2">
                  {weekSchedule.map((day) => (
                    <div key={day.date} className={`rounded-lg border bg-card flex flex-col overflow-hidden ${isToday(day.date) ? "ring-1 ring-primary border-primary/50" : ""}`}>
                      <div className={`px-2 py-2 text-center border-b ${isToday(day.date) ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}>
                        <p className="text-[11px] font-semibold leading-none">{formatDayHeader(day.date)}</p>
                        {isToday(day.date) && <p className="text-[10px] opacity-80 mt-0.5">Today</p>}
                      </div>
                      <div className="flex-1 p-1.5 space-y-1 min-h-[140px]">
                        {day.slots.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground text-center py-6">Closed</p>
                        ) : (
                          day.slots.map((slot) => {
                            const isAvailable = slot.status === "available" && shopOpen;
                            return (
                              <button
                                key={slot.time}
                                onClick={() => isAvailable && handleSlotClick(slot.time, day.date)}
                                disabled={!isAvailable}
                                className={`w-full text-left rounded-md px-2 py-1.5 border-l-[3px] transition-all text-[11px] leading-tight
                                  ${!shopOpen ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed border-l-slate-300"
                                    : isAvailable
                                      ? "bg-white border-slate-200 border-l-emerald-500 hover:bg-emerald-50 hover:border-emerald-200 shadow-sm cursor-pointer"
                                      : "bg-rose-50/70 border-rose-200 border-l-rose-500 text-rose-700 cursor-not-allowed"
                                  }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-medium tabular-nums">{formatSlotTime(slot.time)}</span>
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAvailable ? "bg-emerald-500" : "bg-rose-500"}`} />
                                </div>
                                <div className={`text-[10px] mt-0.5 ${isAvailable ? "text-emerald-700" : "text-rose-600"}`}>
                                  {isAvailable ? "Available" : "Booked"}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile: day tabs + Google-style list */}
                <div className="md:hidden space-y-3">
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {weekSchedule.map((day) => {
                      const free = day.slots.filter((s) => s.status === "available").length;
                      const booked = day.slots.filter((s) => s.status === "booked").length;
                      const active = (selectedDay ?? weekSchedule[0]?.date) === day.date;
                      return (
                        <button
                          key={day.date}
                          onClick={() => setSelectedDay(day.date)}
                          className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors min-w-[92px]
                            ${active ? "bg-primary text-primary-foreground border-primary shadow" : "bg-card border-border"}
                            ${isToday(day.date) && !active ? "ring-1 ring-primary" : ""}`}
                        >
                          <p className="text-xs font-semibold leading-none">{formatDayHeader(day.date)}</p>
                          <p className="text-[11px] mt-1 opacity-80">{day.slots.length === 0 ? "Closed" : `${free} free · ${booked} booked`}</p>
                        </button>
                      );
                    })}
                  </div>
                  {mobileDay && (
                    <div className="rounded-lg border bg-card overflow-hidden">
                      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                        <p className="text-xs font-semibold">{formatDayHeader(mobileDay.date)} <span className="font-normal text-muted-foreground">· {mobileDay.date}</span></p>
                        <Badge variant="outline" className="text-[10px] h-5">{mobileDay.slots.length} slots</Badge>
                      </div>
                      <div className="p-2 space-y-1.5">
                        {mobileDay.slots.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-6">Closed — no availability</p>
                        ) : (
                          mobileDay.slots.map((slot) => {
                            const isAvailable = slot.status === "available" && shopOpen;
                            const end = new Date(new Date(slot.time).getTime() + singletonDuration * 60000);
                            return (
                              <button
                                key={slot.time}
                                onClick={() => isAvailable && handleSlotClick(slot.time, mobileDay.date)}
                                disabled={!isAvailable}
                                className={`w-full rounded-lg border-l-[3px] px-3 py-2.5 flex items-center justify-between text-left transition-colors
                                  ${!shopOpen ? "bg-slate-50 border-slate-200 border-l-slate-300 text-slate-400"
                                    : isAvailable ? "bg-white border-slate-200 border-l-emerald-500 hover:bg-emerald-50 shadow-sm"
                                      : "bg-rose-50 border-rose-200 border-l-rose-500"
                                  }`}
                              >
                                <div>
                                  <p className="text-xs font-medium tabular-nums">{formatSlotTime(slot.time)} <span className="text-muted-foreground font-normal">– {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</span></p>
                                  <p className={`text-[11px] mt-0.5 ${isAvailable ? "text-emerald-700" : "text-rose-600"}`}>{isAvailable ? `Available • ${singletonDuration} min` : "Booked • unavailable"}</p>
                                </div>
                                <span className={`w-2 h-2 rounded-full shrink-0 ${isAvailable ? "bg-emerald-500" : "bg-rose-500"}`} />
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Next appointment highlight */}
        {nextBooking && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase">Next Appointment</p>
                <p className="text-sm font-medium mt-0.5">
                  {serviceMap[nextBooking.service_id] ?? "Appointment"} · {formatSlot(nextBooking.slot_start)}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {nextBooking.pax} {nextBooking.pax === 1 ? "person" : "people"} · {formatSlotRange(nextBooking.slot_start, singletonDuration)}
                </p>
              </div>
              <StatusBadge status={nextBooking.status} />
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Show:</span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredBookings.length} {filteredBookings.length === 1 ? "booking" : "bookings"}
            </span>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Bookings — Google Calendar-style timestamps */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-4">
                  <div className="h-5 w-32 bg-slate-100 rounded mb-2" />
                  <div className="h-3 w-full bg-slate-100 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredBookings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-10 space-y-3">
              <Scissors className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm text-muted-foreground">
                {bookings.length === 0
                  ? "You have no bookings yet."
                  : "No bookings match the selected filter."}
              </p>
              {bookings.length === 0 && (
                <Button size="sm" onClick={() => navigate("/book")} disabled={!shopOpen}>
                  Book your first appointment
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredBookings
              .sort((a, b) => new Date(b.slot_start).getTime() - new Date(a.slot_start).getTime())
              .map((b) => (
                <Card key={b.id} className="overflow-hidden">
                  <CardContent className="pt-0 pb-0 flex">
                    {/* Google Calendar left accent — color by status */}
                    <div className={`w-1 shrink-0 self-stretch ${
                      b.status === "booked" ? "bg-blue-500" : b.status === "pending" ? "bg-amber-500" : b.status === "complete" ? "bg-emerald-500" : "bg-slate-300"
                    }`} />
                    <div className="flex-1 pt-4 pb-3 px-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm">
                              {serviceMap[b.service_id] ?? b.service_id.slice(0, 8)}
                            </span>
                            <StatusBadge status={b.status} />
                            <Badge variant="outline" className="text-xs capitalize">
                              {b.downpayment_status.replace("_", " ")}
                            </Badge>
                          </div>

                          {/* Google-style timestamp: date + time range */}
                          <div className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 text-slate-400">🗓️</span>
                            <div>
                              <div className="font-medium text-slate-900 tabular-nums">
                                {new Date(b.slot_start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                              </div>
                              <div className="text-slate-600 tabular-nums">
                                {formatSlotRange(b.slot_start, singletonDuration)}
                                <span className="text-slate-400 mx-1">·</span>
                                {b.pax} {b.pax === 1 ? "person" : "people"}
                              </div>
                            </div>
                          </div>

                          {b.notes && (
                            <div className="text-xs text-slate-500 italic bg-slate-50 rounded px-2 py-1 inline-block">"{b.notes}"</div>
                          )}

                          <div className="text-xs text-muted-foreground">
                            Created: {new Date(b.created_at).toLocaleString()}
                            {b.arrival_time && (
                              <span className="ml-2">
                                · Arrived: {new Date(b.arrival_time).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {(b.status === "pending" || b.payment_proof_url) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {b.status === "pending"
                              ? b.payment_proof_url
                                ? "Proof uploaded — awaiting owner verification."
                                : "No proof yet — upload to confirm your slot."
                              : "Payment proof attached."}
                          </span>
                          {b.status === "pending" ? (
                            <Button
                              size="sm"
                              variant={b.payment_proof_url ? "outline" : "default"}
                              className="h-7 text-xs active:scale-95"
                              onClick={() => setProofBooking(b)}
                            >
                              {b.payment_proof_url ? "Update proof" : "Add payment proof"}
                            </Button>
                          ) : (
                            b.payment_proof_url && (
                              <a
                                href={b.payment_proof_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                View
                              </a>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        <PaymentProofDialog
          key={proofBooking?.id ?? "none"}
          booking={proofBooking}
          serviceName={services[0]?.name ?? "Appointment"}
          durationMinutes={singletonDuration}
          onClose={() => setProofBooking(null)}
          onSaved={handleProofSaved}
        />

        {!loading && (
          <>
            <Separator />
            <div className="text-center">
              <Button variant="ghost" onClick={handleLogout} className="text-xs text-muted-foreground">
                Log out
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
