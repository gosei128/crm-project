import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getShopStatus,
  getSingletonService,
  getShopRules,
  createPublicBooking,
  lookupBooking,
  uploadPaymentProofFile,
  isSlotTakenError,
  slotTakenMessage,
  type Service,
  type ShopRule,
  type ShopStatus,
  type Booking,
} from "@/lib/api";
import { PROOF_ACCEPT, validateProofFile } from "@/lib/media";
import GcashPaymentCard from "@/components/booking/GcashPaymentCard";
import SchedulingSection from "@/components/scheduling/SchedulingSection";
import { formatCountdown, useCountdown } from "@/components/scheduling/useCountdown";
import PublicNav, { NavSentinel } from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";

type Step = "datetime" | "info" | "rules" | "success";

function monthOfDay(day: string): string {
  return day.slice(0, 7);
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Live countdown for the success-ticket hold notice. Expiry truth
 *  comes from the server (created_at + 15-min TTL); this only displays it. */
function HoldCountdown({ createdAt }: { createdAt: string }) {
  const expiresAt = (() => {
    try {
      return new Date(new Date(createdAt).getTime() + 15 * 60000).toISOString();
    } catch {
      return null;
    }
  })();
  const secondsLeft = useCountdown(expiresAt);
  if (secondsLeft === null) return null;
  if (secondsLeft <= 0) return <span>Hold expired — please book again.</span>;
  return (
    <span className="font-mono font-bold tabular-nums" aria-live="polite">
      {formatCountdown(secondsLeft)} left
    </span>
  );
}

function formatSlotRange(slot: string, durationMinutes?: number) {
  const start = new Date(slot);
  const end = durationMinutes ? new Date(start.getTime() + durationMinutes * 60000) : null;
  const fmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return end ? `${fmt(start)} - ${fmt(end)}` : fmt(start);
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-bronze/15 text-bronze",
    booked: "bg-oxblood/10 text-oxblood",
    complete: "bg-moss/15 text-moss",
    expired: "bg-espresso/10 text-espresso/60",
    cancelled: "bg-oxblood/10 text-oxblood",
    cancelled_no_show: "bg-oxblood/10 text-oxblood",
    cancelled_late: "bg-oxblood/10 text-oxblood",
  };
  return map[status] ?? "bg-espresso/10 text-espresso/60";
}

/** Customer-facing appointment label: the haircut being finished reads as
 *  HAIRCUT DONE so it can't be mistaken for a payment state. Payment has
 *  its own separate Downpayment row (see downpaymentLabel). */
function customerStatusLabel(status: string): string {
  if (status === "complete") return "HAIRCUT DONE";
  return status.toUpperCase().replace(/_/g, " ");
}

/** Customer-facing downpayment label — plain words, never the raw enum. */
function downpaymentLabel(value: string): string {
  if (value === "confirmed") return "Received ✓";
  if (value === "pending_verification") return "Waiting verification";
  return "Not paid";
}

/** Same-device resume for guests: one-tap shortcut back to an unfinished
 *  booking on this device (any device can also use the ref-code lookup). */
const LAST_BOOKING_KEY = "kabarbers_last_booking";

interface StoredBooking {
  booking: Booking;
  customerName: string;
  customerPhone: string;
  pax: number;
  notes: string;
  selectedDate: string;
  selectedSlot: string;
}

function loadStoredBooking(): StoredBooking | null {
  try {
    const raw = localStorage.getItem(LAST_BOOKING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBooking;
    if (!parsed?.booking?.id || !parsed?.selectedSlot) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function Book() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // --- step state ---
  // Coming from Schedule with pre-filled date/time? Skip straight to info
  // (the selection states below already pick up the same URL params).
  const [step, setStep] = useState<Step>(() =>
    searchParams.get("date") && searchParams.get("time") ? "info" : "datetime",
  );

  // --- data ---
  const [service, setService] = useState<Service | null>(null);
  const [shopRules, setShopRules] = useState<ShopRule[]>([]);
  const [shopStatus, setShopStatus] = useState<ShopStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- selections (owned by the SchedulingSection container) ---
  const [selectedDate, setSelectedDate] = useState<string>(searchParams.get("date") ?? "");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(searchParams.get("time"));
  const [viewMonth, setViewMonth] = useState<string>(() => {
    const d = searchParams.get("date");
    return d ? monthOfDay(d) : currentMonth();
  });
  // Specific "someone just took this slot" notice (409) — distinct from
  // the generic error banner, with the day auto-refreshed underneath.
  const [takenSlotNotice, setTakenSlotNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // --- form ---
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pax, setPax] = useState(1);
  const [notes, setNotes] = useState("");

  // --- rules acknowledgement (required before confirming) ---
  const [agreedToRules, setAgreedToRules] = useState(false);

  // --- result ---
  const [booking, setBooking] = useState<Booking | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  // --- guest status lookup (reference code + phone, works on any device) ---
  const [lookupCode, setLookupCode] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupResult, setLookupResult] = useState<Booking | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // --- live booking status (fixes stale "awaiting review" after the owner
  //  confirms: the stored snapshot is revalidated against the server) ---
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [staleSnapshot, setStaleSnapshot] = useState(false);
  const [replacingProof, setReplacingProof] = useState(false);
  // Monotonic request id — a slow lookup must never overwrite fresher state.
  const statusSeq = useRef(0);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const found = await lookupBooking(lookupCode, lookupPhone);
      setLookupResult(found);
    } catch (err: unknown) {
      setLookupError(
        err instanceof Error ? err.message : "Booking not found",
      );
    } finally {
      setLookupLoading(false);
    }
  }

  // --- same-device resume (one-tap shortcut; ref-code lookup works anywhere) ---
  const [stored, setStored] = useState<StoredBooking | null>(loadStoredBooking);

  // Revoke the preview object URL when it changes or on unmount.
  useEffect(() => {
    return () => {
      if (proofPreview) URL.revokeObjectURL(proofPreview);
    };
  }, [proofPreview]);

  function clearProofSelection() {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(null);
    setProofPreview(null);
    setProofError(null);
  }

  function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(null);
    setProofError(null);
    if (!file) {
      setProofFile(null);
      return;
    }
    const validationError = validateProofFile(file);
    if (validationError) {
      setProofFile(null);
      setProofError(validationError);
      return;
    }
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  }

  function persistStored(b: Booking) {
    try {
      const entry: StoredBooking = {
        booking: b,
        customerName,
        customerPhone,
        pax,
        notes,
        selectedDate,
        selectedSlot: selectedSlot ?? b.slot_start,
      };
      localStorage.setItem(LAST_BOOKING_KEY, JSON.stringify(entry));
    } catch {
      // storage unavailable — resume just won't be offered
    }
  }

  /** Re-fetch the live booking from the server (ref code + phone).
   *  Returns the fresh booking, or null when it failed (state untouched).
   *  `manual` controls whether the user sees a notice for no-change. */
  async function refreshBookingStatus(
    target: Booking,
    phone: string,
    manual: boolean,
  ): Promise<Booking | null> {
    if (!target.reference_code || !phone.trim()) return null;
    const seq = ++statusSeq.current;
    if (manual) {
      setRefreshingStatus(true);
      setStatusNotice(null);
    }
    try {
      const fresh = await lookupBooking(
        target.reference_code,
        phone,
      );
      // A slower earlier request must not clobber newer state.
      if (seq !== statusSeq.current) return null;
      const changed =
        fresh.status !== target.status ||
        (fresh.payment_proof_url ?? null) !== (target.payment_proof_url ?? null) ||
        fresh.downpayment_status !== target.downpayment_status;
      setBooking(fresh);
      setStaleSnapshot(false);
      if (
        fresh.status !== "pending" &&
        fresh.status !== "booked"
      ) {
        // Finished (complete/expired/cancelled) — the banner auto-removes;
        // the lookup card below remains for history checks.
        try {
          localStorage.removeItem(LAST_BOOKING_KEY);
        } catch {
          // storage unavailable — nothing to clear
        }
        setStored(null);
      } else {
        persistStored(fresh);
      }
      if (manual) {
        setStatusNotice(
          changed
            ? `Status updated: ${customerStatusLabel(fresh.status)}`
            : "Already up to date.",
        );
      } else if (changed && fresh.status !== "pending") {
        setStatusNotice(
          `Status updated: ${customerStatusLabel(fresh.status)}`,
        );
      }
      return fresh;
    } catch (err: unknown) {
      if (seq !== statusSeq.current) return null;
      if (manual) {
        setStatusNotice(
          err instanceof Error ? err.message : "Could not refresh status.",
        );
      }
      return null;
    } finally {
      if (manual && seq === statusSeq.current) setRefreshingStatus(false);
    }
  }

  function handleResumeBooking() {
    if (!stored) return;
    setCustomerName(stored.customerName);
    setCustomerPhone(stored.customerPhone);
    setPax(stored.pax);
    setNotes(stored.notes);
    setSelectedDate(stored.selectedDate);
    setSelectedSlot(stored.selectedSlot);
    setBooking(stored.booking);
    clearProofSelection();
    setError(null);
    setStatusNotice(null);
    setReplacingProof(false);
    // The snapshot may predate the owner's confirmation — revalidate it
    // against the server so a confirmed booking doesn't show as
    // "awaiting review" forever. Falls back to the snapshot offline.
    if (stored.booking.reference_code && stored.customerPhone.trim()) {
      setStaleSnapshot(false);
      void refreshBookingStatus(stored.booking, stored.customerPhone, false).then(
        (fresh) => {
          if (!fresh) setStaleSnapshot(true);
        },
      );
    } else {
      // Bookings saved before ref codes existed can't be revalidated.
      setStaleSnapshot(true);
    }
    setStep("success");
  }

  function handleDiscardStored() {
    try {
      localStorage.removeItem(LAST_BOOKING_KEY);
    } catch {
      // storage unavailable — nothing to clear
    }
    setStored(null);
  }

  // --- load singleton service + rules + GCash details on mount ---
  useEffect(() => {
    getSingletonService()
      .then((s) => setService(s))
      .catch((e) => setError(e.message));
    getShopRules()
      .then((r) => setShopRules(r))
      .catch(() => {});
    getShopStatus()
      .then((s) => setShopStatus(s))
      .catch(() => {});
  }, []);

  // --- banner lifecycle: silently revalidate the saved booking on mount so
  //  the banner reflects reality instead of nagging forever.
  //  booked → snapshot refreshed, banner becomes "View ticket".
  //  complete/expired/cancelled → saved entry removed, banner auto-vanishes.
  //  Lookup failure (offline) → banner stays as the fallback.
  useEffect(() => {
    const entry = loadStoredBooking();
    if (!entry?.booking?.reference_code || !entry.customerPhone.trim()) return;
    let cancelled = false;
    lookupBooking(entry.booking.reference_code, entry.customerPhone)
      .then((fresh) => {
        if (cancelled) return;
        if (fresh.status === "booked") {
          const next = { ...entry, booking: fresh };
          try {
            localStorage.setItem(LAST_BOOKING_KEY, JSON.stringify(next));
          } catch {
            // storage unavailable — banner still updates for this visit
          }
          setStored(next);
        } else if (fresh.status !== "pending") {
          try {
            localStorage.removeItem(LAST_BOOKING_KEY);
          } catch {
            // storage unavailable — nothing to clear
          }
          setStored(null);
        } else if (
          (fresh.payment_proof_url ?? null) !==
            (entry.booking.payment_proof_url ?? null) ||
          fresh.downpayment_status !== entry.booking.downpayment_status
        ) {
          const next = { ...entry, booking: fresh };
          try {
            localStorage.setItem(LAST_BOOKING_KEY, JSON.stringify(next));
          } catch {
            // storage unavailable — banner still updates for this visit
          }
          setStored(next);
        }
      })
      .catch(() => {
        // offline or lookup failed — keep the saved banner as fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- live status polling: while a pending OR booked booking is on screen,
  //  re-check every 30s so owner taps (confirm, arrived, complete, no-show)
  //  flip the ticket automatically. Stops at complete/terminal states.
  //  Paused when the tab is hidden; silent failures (offline) keep old state.
  useEffect(() => {
    if (step !== "success" || !booking) return;
    if (booking.status !== "pending" && booking.status !== "booked") return;
    if (!booking.reference_code || !customerPhone.trim()) return;
    let cancelled = false;
    let timer: number | null = null;
    const snapshot = booking;
    const phone = customerPhone;
    const tick = async () => {
      if (cancelled) return;
      if (!document.hidden) {
        await refreshBookingStatus(snapshot, phone, false);
      }
      if (!cancelled) timer = window.setTimeout(tick, 30000);
    };
    const onVisible = () => {
      if (!document.hidden && !cancelled) {
        void refreshBookingStatus(snapshot, phone, false);
      }
    };
    timer = window.setTimeout(tick, 30000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Re-arms when a fresh booking object lands (status/proof transitions).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, booking?.id, booking?.status, booking?.payment_proof_url]);

  // --- handlers (scheduling state lives in SchedulingSection) ---
  function handleDateSelect(dateStr: string) {
    setSelectedDate(dateStr);
    // New date → drop the old time selection.
    setSelectedSlot(null);
    setTakenSlotNotice(null);
    setError(null);
  }

  function handleMonthChange(m: string) {
    setViewMonth(m);
    // Month navigation clears the slot selection cleanly — never leave
    // a phantom selected slot from a different month.
    setSelectedSlot(null);
    setTakenSlotNotice(null);
  }

  function handleSlotSelect(slot: string) {
    setSelectedSlot(slot);
    setTakenSlotNotice(null);
    setStep("info");
  }

  function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      setError("Name and phone are required");
      return;
    }
    setAgreedToRules(false);
    setStep("rules");
  }

  async function handleConfirm() {
    if (!selectedSlot) return;
    setLoading(true);
    setError(null);
    setTakenSlotNotice(null);
    try {
      // Guest-only booking — no account needed. Returning guests pick up
      // unfinished bookings on this device via the stored-booking banner.
      const result = await createPublicBooking({
        slot_start: selectedSlot,
        customer_name: customerName,
        customer_phone: customerPhone,
        pax,
        notes: notes || undefined,
      });
      setBooking(result);
      persistStored(result);
      setStep("success");
    } catch (e: unknown) {
      if (isSlotTakenError(e)) {
        // Expected race: the slot flipped Pending/Booked between day-load
        // and submit. Show the specific message, refresh the day + month,
        // and drop the stale selection instead of leaving it selected.
        setTakenSlotNotice(slotTakenMessage());
        setSelectedSlot(null);
        setStep("datetime");
        if (selectedDate) {
          void queryClient.invalidateQueries({ queryKey: ["dayAvailability", selectedDate] });
          void queryClient.invalidateQueries({ queryKey: ["monthAvailability", viewMonth] });
        }
      } else {
        setError(e instanceof Error ? e.message : "Booking failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePaymentProof() {
    if (!booking || !proofFile) return;
    setLoading(true);
    setError(null);
    setProofError(null);
    try {
      const updated = await uploadPaymentProofFile(booking.id, proofFile);
      setBooking(updated);
      persistStored(updated);
      clearProofSelection();
      setReplacingProof(false);
      setStaleSnapshot(false);
    } catch (e: unknown) {
      setProofError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  // --- success-stage derivation (5th stage: status-driven panels) ---
  const isBooked = booking?.status === "booked";
  const isPending = booking?.status === "pending";
  const hasProof = !!booking?.payment_proof_url;
  const isComplete = booking?.status === "complete";
  const isTerminal =
    !!booking && !isBooked && !isPending && !isComplete;
  const terminalLabel = customerStatusLabel(booking?.status ?? "");
  const canRefreshStage =
    step === "success" && !!booking && isPending && !!booking.reference_code;

  function handleCopyRefCode() {
    if (!booking?.reference_code) return;
    void navigator.clipboard.writeText(booking.reference_code).catch(() => {});
  }

  function handleManualRefresh() {
    if (!booking || !customerPhone.trim()) return;
    void refreshBookingStatus(booking, customerPhone, true);
  }

  return (
    <div className="min-h-[100dvh] bg-parchment text-espresso">
      <PublicNav />
      <NavSentinel />
      <div
        className={`mx-auto w-full space-y-4 px-4 pt-24 pb-16 ${
          step === "datetime" ? "max-w-6xl" : "max-w-lg"
        }`}
      >
        {/* header */}
        <div className="text-center mb-6">
          <p className="font-script text-2xl text-brass-deep">
            Kabarbers
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-wide uppercase">Book your cut</h1>
          <p className="text-sm text-espresso/65 mt-1">
            {service ? `${service.name}, ${service.duration_minutes} min. Strictly by appointment` : "Book your appointment online"}
          </p>
        </div>

        {/* progress indicator — a 5th "ticket" dot appears once the
            booking is owner-confirmed */}
        <div className="flex items-center justify-center gap-2 text-xs text-espresso/55">
          {(booking?.status === "booked"
            ? (["datetime", "info", "rules", "success", "ticket"] as const)
            : (["datetime", "info", "rules", "success"] as const)
          ).map((s, i, arr) => {
            const active =
              s === "ticket" ? booking?.status === "booked" : step === s;
            return (
              <div key={s} className="flex items-center gap-1">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-medium
                ${active ? "bg-accent-deep text-cream-ink" : "bg-espresso/10 text-espresso/60"}`}
                >
                  {i + 1}
                </span>
                {i < arr.length - 1 && <span className="w-4 h-px bg-espresso/15" />}
              </div>
            );
          })}
        </div>

        {/* error banner */}
        {error && (
          <div className="border border-red-800/25 bg-red-50 rounded-md px-4 py-2 text-sm text-red-900">
            {error}
          </div>
        )}

        {/* resume banner — status-aware: pending offers continue, booked
            offers the ticket, finished bookings auto-remove the save */}
        {stored && step !== "success" && (
          <Card className="border-bronze/40 bg-bronze/[0.08]">
            <CardContent className="flex flex-wrap items-center gap-3 py-3">
              <span className="rounded-lg bg-bronze/15 p-2 text-bronze">
                <History className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-espresso">
                  {stored.booking.status === "booked"
                    ? "Booking confirmed — your ticket is ready"
                    : "Unfinished booking found"}
                </p>
                <p className="truncate text-xs text-espresso/60 tabular-nums">
                  {stored.customerName}, {stored.selectedDate} at{" "}
                  {formatSlotRange(stored.selectedSlot, service?.duration_minutes)}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-bronze hover:bg-bronze/10 hover:text-brass-deep"
                  onClick={handleDiscardStored}
                >
                  Dismiss
                </Button>
                <Button size="sm" className="h-7 bg-accent-deep text-xs whitespace-nowrap text-cream-ink hover:bg-oxblood-bright" onClick={handleResumeBooking}>
                  {stored.booking.status === "booked" ? "View ticket" : "Continue payment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 1: Scheduling (calendar grid + day slot picker) ── */}
        {step === "datetime" && (
          <>
            <SchedulingSection
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              ownPendingSlot={null}
              serviceName={service?.name}
              serviceDurationMinutes={service?.duration_minutes}
              takenSlotNotice={takenSlotNotice}
              onSelectDate={handleDateSelect}
              onSelectSlot={handleSlotSelect}
              onMonthChange={handleMonthChange}
              viewMonth={viewMonth}
            />
            <div>
              <Button variant="ghost" onClick={() => navigate("/schedule")} className="mt-2 text-espresso/70 hover:bg-espresso/5 hover:text-espresso">
                ← View weekly schedule
              </Button>
            </div>
          </>
        )}

        {/* ── STEP 2: Customer Info ───────────────────── */}
        {step === "info" && (
          <Card className="border-espresso/10 bg-cream text-espresso shadow-[0_2px_16px_-8px_rgb(43_33_24/0.3)]">
            <CardHeader>
              <CardTitle>Your Details</CardTitle>
              <CardDescription>We just need your name and phone number.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInfoSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    placeholder="Juan Dela Cruz"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    placeholder="0917 123 4567"
                  />
                </div>

                <div>
                  <Label htmlFor="pax">Number of People (Pax)</Label>
                  <Input
                    id="pax"
                    type="number"
                    min={1}
                    max={10}
                    value={pax}
                    onChange={(e) => setPax(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special requests..."
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setStep("datetime")} className="text-espresso/70 hover:bg-espresso/5 hover:text-espresso">
                    ← Back
                  </Button>
                  <Button type="submit" className="flex-1 bg-accent-deep font-semibold whitespace-nowrap text-cream-ink hover:bg-oxblood-bright">
                    Review Rules
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 3: Shop Rules ─────────────────────── */}
        {step === "rules" && (
          <Card className="border-espresso/10 bg-cream text-espresso shadow-[0_2px_16px_-8px_rgb(43_33_24/0.3)]">
            <CardHeader>
              <CardTitle>Shop Rules & Policies</CardTitle>
              <CardDescription>Please read before reserving your slot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {shopRules.length > 0 ? (
                <ol className="space-y-3 list-decimal list-inside text-sm">
                  {[...shopRules]
                    .sort((a, b) => a.order - b.order)
                    .map((rule) => (
                      <li key={rule.id} className="text-espresso/80">
                        <span className="font-semibold text-espresso">
                          {rule.title}
                        </span>:{" "}
                        {rule.text}
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="text-sm text-espresso/55">No rules configured yet.</p>
              )}

              <Separator className="my-4 bg-espresso/10" />

              <div className="flex items-start gap-2.5 rounded-md border border-espresso/15 bg-espresso/[0.03] p-3">
                <input
                  id="agree-rules"
                  type="checkbox"
                  checked={agreedToRules}
                  onChange={(e) => setAgreedToRules(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <Label htmlFor="agree-rules" className="text-sm font-normal leading-snug cursor-pointer">
                  I have read and agree to the shop rules above, including the
                  late-arrival, no-show deposit forfeiture, and check-in
                  confirmation policies.
                </Label>
              </div>

              {/* booking summary — Google-style timestamp */}
              <div className="bg-espresso/[0.03] border border-espresso/10 rounded-md p-3 text-sm space-y-1">
                <div className="font-medium text-espresso">Booking Summary</div>
                <div className="text-espresso/65">
                  {service?.name} · {service?.duration_minutes} min
                </div>
                <div className="text-espresso/65 tabular-nums">
                  {selectedDate} · {selectedSlot ? formatSlotRange(selectedSlot, service?.duration_minutes) : ""}
                </div>
                <div className="text-espresso/65">
                  {pax} {pax === 1 ? "person" : "people"} · {customerName}
                </div>
                {notes && <div className="text-espresso/55 italic">Note: {notes}</div>}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep("info")} className="text-espresso/70 hover:bg-espresso/5 hover:text-espresso">
                  ← Back
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={loading || !agreedToRules}
                  className="flex-1 bg-accent-deep font-semibold whitespace-nowrap text-cream-ink hover:bg-oxblood-bright disabled:opacity-50"
                  title={agreedToRules ? undefined : "Please agree to the shop rules first"}
                >
                  {loading ? "Reserving…" : "Reserve Slot"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 4: Hold / Payment ──────────────────── */}
        {step === "success" && booking && (
          <Card className="border-espresso/10 bg-cream text-espresso shadow-[0_2px_16px_-8px_rgb(43_33_24/0.3)]">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span>
                  {isBooked
                    ? "Booking Confirmed"
                    : isComplete
                      ? "Haircut Done"
                      : isTerminal
                        ? terminalLabel || "Booking Ended"
                        : hasProof
                          ? "Awaiting Review"
                          : "Slot Reserved"}
                </span>
                <Badge className={booking ? getStatusBadge(booking.status) : ""}>
                  {isPending
                    ? hasProof
                      ? "AWAITING REVIEW"
                      : "AWAITING PROOF"
                    : terminalLabel}
                </Badge>
                {canRefreshStage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-espresso/20 px-2 text-xs text-espresso hover:bg-espresso/5"
                    disabled={refreshingStatus}
                    onClick={handleManualRefresh}
                  >
                    {refreshingStatus ? "Refreshing…" : "Refresh status"}
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                Ref code:{" "}
                <code className="font-mono text-xs font-bold tracking-wider">
                  {booking.reference_code ?? "—"}
                </code>
              </CardDescription>
              {statusNotice && (
                <p className="rounded-md border border-moss/30 bg-moss/[0.07] px-3 py-1.5 text-xs text-moss">
                  {statusNotice}
                </p>
              )}
              {staleSnapshot && (
                <p className="rounded-md border border-bronze/40 bg-bronze/[0.08] px-3 py-1.5 text-xs text-bronze">
                  Showing your saved copy — it may be outdated. Use Refresh status
                  (or the lookup below) for the latest.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ── Stage 5a: confirmed ticket ── */}
              {isBooked && (
                <div className="rounded-lg border border-moss/40 bg-moss/[0.08] px-4 py-4 text-center">
                  <p className="text-2xl" aria-hidden="true">🎟️</p>
                  <p className="mt-1 text-base font-bold text-moss">
                    Your booking is confirmed
                  </p>
                  <p className="mt-1 text-sm text-espresso/75">
                    Downpayment received. Walk straight to the chair and present
                    this ticket code at check-in:
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <p className="font-mono text-2xl font-bold tracking-widest text-espresso tabular-nums">
                      {booking.reference_code ?? "—"}
                    </p>
                    {booking.reference_code && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-moss/40 px-2 text-xs text-moss hover:bg-moss/10 hover:text-moss"
                        onClick={handleCopyRefCode}
                      >
                        Copy
                      </Button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-espresso/70 tabular-nums">
                    {selectedDate} ·{" "}
                    {selectedSlot
                      ? formatSlotRange(selectedSlot, service?.duration_minutes)
                      : ""}
                  </p>
                </div>
              )}

              {/* ── terminal / complete states ── */}
              {isComplete && (
                <div className="rounded-md border border-moss/30 bg-moss/[0.07] px-4 py-3 text-sm">
                  <p className="font-medium text-moss">✓ Haircut done — thanks for visiting Kabarbers.</p>
                  <p className="mt-1 text-espresso/75">
                    Show this screen if asked — your ref code above is your record.
                  </p>
                </div>
              )}
              {isTerminal && (
                <div className="rounded-md border border-oxblood/30 bg-oxblood/[0.06] px-4 py-3 text-sm">
                  <p className="font-medium text-oxblood">
                    Booking {terminalLabel.toLowerCase()}
                  </p>
                  <p className="mt-1 text-espresso/75">
                    This booking is no longer active and its downpayment is
                    forfeited. Use Book Another below for a new slot.
                  </p>
                </div>
              )}

              {/* ── pending: check-in code box ── */}
              {isPending && (
                <div className="rounded-md border border-bronze/40 bg-bronze/[0.08] px-4 py-3 text-sm">
                  <p className="font-semibold text-bronze">
                    Reservation held. Present this code at check-in
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="font-mono text-lg font-bold tracking-wide text-espresso tabular-nums">
                      {booking.reference_code ?? "—"}
                    </p>
                    {booking.reference_code && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-espresso/20 px-2 text-xs text-espresso hover:bg-espresso/5"
                        onClick={handleCopyRefCode}
                      >
                        Copy
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-espresso/70">
                    {selectedDate} ·{" "}
                    {selectedSlot
                      ? formatSlotRange(selectedSlot, service?.duration_minutes)
                      : ""}
                  </p>
                </div>
              )}

              {/* ── Stage 5b: awaiting review (proof in, owner hasn't confirmed) ── */}
              {isPending && hasProof && (
                <div className="rounded-md border border-bronze/40 bg-bronze/[0.08] px-4 py-3 text-sm">
                  <p className="font-medium text-bronze">
                    ⏳ Awaiting review — your slot is pending
                  </p>
                  <p className="mt-1 text-espresso/75">
                    We received your proof of payment. The owner will verify
                    the GCash payment and confirm your booking — no further
                    action needed from you. This page checks automatically;
                    you can also tap Refresh status anytime.
                  </p>
                </div>
              )}

              {/* ── pending without proof: payment required ── */}
              {isPending && !hasProof && (
                <div className="bg-bronze/[0.08] border border-bronze/40 rounded-md px-4 py-3 text-sm">
                  <p className="font-medium text-bronze">⚠ Payment Required</p>
                  <p className="text-espresso/75 mt-1">
                    Your slot is held for 15 minutes (
                    {booking?.created_at ? (
                      <HoldCountdown createdAt={booking.created_at} />
                    ) : (
                      "15:00"
                    )}
                    ). Send the downpayment via GCash below and upload your
                    proof of payment to keep it — the hold lifts once your
                    proof is in, and the owner confirms your booking after
                    verifying payment.
                  </p>
                </div>
              )}

              {isPending && !hasProof && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-espresso">Pay via GCash</p>
                  <GcashPaymentCard
                    gcashNumber={shopStatus?.gcash_number}
                    gcashAccountName={shopStatus?.gcash_account_name}
                    gcashQrUrl={shopStatus?.gcash_qr_url}
                  />
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-espresso/55">Service</span>
                  <span className="font-medium text-espresso">{service?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-espresso/55">Date & Time</span>
                  <span className="font-medium text-espresso tabular-nums">
                    {selectedDate} · {selectedSlot ? formatSlotRange(selectedSlot, service?.duration_minutes) : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-espresso/55">Pax</span>
                  <span className="font-medium text-espresso">{booking.pax}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-espresso/55">Downpayment</span>
                  <Badge variant="outline" className="border-espresso/20 text-espresso">
                    {booking ? downpaymentLabel(booking.downpayment_status) : "—"}
                  </Badge>
                </div>
              </div>

              <Separator className="bg-espresso/10" />

              {/* proof upload — pending only; collapses once a proof is in */}
              {isPending && hasProof && !replacingProof ? (
                <div className="space-y-2">
                  <p className="text-xs text-moss">
                    ✓ Proof uploaded — your slot is held while the owner verifies payment.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-espresso/60 hover:bg-espresso/5 hover:text-espresso"
                    onClick={() => setReplacingProof(true)}
                  >
                    Upload a different receipt
                  </Button>
                </div>
              ) : (
                isPending && (
                  <div className="space-y-2">
                    <Label htmlFor="proof-file" className="text-sm font-medium">
                      {hasProof ? "Replace Payment Proof" : "Upload Payment Proof"}
                    </Label>
                    <p className="text-xs text-espresso/55">
                      Choose a photo of your GCash receipt (JPG, PNG, or WEBP · max 5 MB)
                    </p>
                    <div className="flex gap-2">
                      <Input
                        id="proof-file"
                        type="file"
                        accept={PROOF_ACCEPT}
                        onChange={handleProofSelect}
                        disabled={loading || booking.downpayment_status === "confirmed"}
                        className="cursor-pointer border-espresso/20 bg-espresso/[0.04] text-espresso file:mr-3 file:rounded file:border-0 file:bg-espresso/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-espresso"
                      />
                      <Button
                        onClick={handlePaymentProof}
                        disabled={loading || !proofFile || booking.downpayment_status === "confirmed"}
                        variant="outline"
                        className="border-espresso/20 text-espresso hover:bg-espresso/5 hover:text-espresso"
                      >
                        {loading ? "Uploading…" : "Upload"}
                      </Button>
                    </div>
                    {hasProof && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-espresso/60 hover:bg-espresso/5 hover:text-espresso"
                        onClick={() => {
                          clearProofSelection();
                          setReplacingProof(false);
                        }}
                      >
                        Keep current proof
                      </Button>
                    )}
                    {proofPreview && (
                      <img
                        src={proofPreview}
                        alt="Selected GCash payment proof preview"
                        className="max-h-48 w-full rounded-lg border border-espresso/10 object-contain"
                      />
                    )}
                    {proofError && (
                      <p className="text-xs text-red-700">{proofError}</p>
                    )}
                  </div>
                )
              )}

              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline" onClick={() => navigate("/")} className="border-espresso/20 text-espresso hover:bg-espresso/5 hover:text-espresso">
                  Back to home
                </Button>
                <Button
                  variant="ghost"
                  className="text-espresso/60 hover:bg-espresso/5 hover:text-espresso"
                  onClick={() => {
                    handleDiscardStored();
                    setStep("datetime");
                    setSelectedDate("");
                    setSelectedSlot(null);
                    setBooking(null);
                    setCustomerName("");
                    setCustomerPhone("");
                    setPax(1);
                    setNotes("");
                    clearProofSelection();
                    setAgreedToRules(false);
                    setStatusNotice(null);
                    setStaleSnapshot(false);
                    setReplacingProof(false);
                  }}
                >
                  Book Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {/* ── Guest status lookup (any device, no login) ── */}
        <Card className="border-espresso/10 bg-cream text-espresso shadow-[0_2px_16px_-8px_rgb(43_33_24/0.3)]">
          <CardHeader>
            <CardTitle className="text-base">Check your booking status</CardTitle>
            <CardDescription>
              Enter the ref code from your confirmation plus your phone number.
              Tickets stay viewable for 7 days after your haircut.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleLookup(e)} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="lookup-code">Ref code</Label>
                  <Input
                    id="lookup-code"
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                    placeholder="KX7Q2M9A"
                    required
                    className="font-mono tracking-wider tabular-nums"
                  />
                </div>
                <div>
                  <Label htmlFor="lookup-phone">Phone number</Label>
                  <Input
                    id="lookup-phone"
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    placeholder="0917 123 4567"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={lookupLoading}
                variant="outline"
                className="w-full border-espresso/20 text-espresso hover:bg-espresso/5 hover:text-espresso"
              >
                {lookupLoading ? "Looking up…" : "Check status"}
              </Button>
            </form>
            {lookupError && (
              <p className="mt-3 rounded-md border border-red-800/25 bg-red-50 px-3 py-2 text-sm text-red-900">
                {lookupError}
              </p>
            )}
            {lookupResult && (
              <div className="mt-3 space-y-1 rounded-md border border-moss/30 bg-moss/[0.07] px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold tracking-wider tabular-nums">
                    {lookupResult.reference_code}
                  </span>
                  <Badge className={getStatusBadge(lookupResult.status)}>
                    {customerStatusLabel(lookupResult.status)}
                  </Badge>
                </div>
                <p className="text-espresso/70 tabular-nums">
                  {new Date(lookupResult.slot_start).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  ·{" "}
                  {new Date(lookupResult.slot_start).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </p>
                <p className="text-xs text-espresso/55">
                  Appointment: {customerStatusLabel(lookupResult.status)}
                  {" · "}Downpayment: {downpaymentLabel(lookupResult.downpayment_status)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-center text-xs text-espresso/50">
          Downpayment required to confirm · No downpayment, no appointment
        </p>
      </div>
      <PublicFooter />
    </div>
  );
}
