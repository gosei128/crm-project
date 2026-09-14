import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getSingletonService,
  getShopRules,
  getWeeklySchedule,
  createPublicBooking,
  uploadPaymentProofFile,
  type Service,
  type ShopRule,
  type Booking,
  type SlotInfo,
} from "@/lib/api";
import { PROOF_ACCEPT, validateProofFile } from "@/lib/media";
import PublicNav, { NavSentinel } from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";

type Step = "datetime" | "info" | "rules" | "success";

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
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

/** Same-device resume for guests: the public booking API has no lookup by
 *  ID, so we stash the last unfinished booking locally. */
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
  const [daySlots, setDaySlots] = useState<SlotInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- selections ---
  const [selectedDate, setSelectedDate] = useState<string>(searchParams.get("date") ?? "");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(searchParams.get("time"));

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

  // --- same-device resume (guest checkout has no booking lookup) ---
  const [stored, setStored] = useState<StoredBooking | null>(loadStoredBooking);
  // Mirror of `step` for the slot-loading effect: reading state there would
  // retrigger it, so a ref is used. Synced here — declared before that
  // effect, so ordering guarantees it always sees the post-render value.
  const stepRef = useRef<Step>(step);
  useEffect(() => {
    stepRef.current = step;
  });

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

  // --- load singleton service + rules on mount ---
  useEffect(() => {
    getSingletonService()
      .then((s) => setService(s))
      .catch((e) => setError(e.message));
    getShopRules()
      .then((r) => setShopRules(r))
      .catch(() => {});
  }, []);

  // Pre-filled slot from Schedule (?date=&time=): keep it selected when
  // (re)loading that day's slots instead of resetting the selection.
  const preTime = searchParams.get("time");

  // --- load slots when date is set — Google-style: show both booked & available via weekly schedule ---
  useEffect(() => {
    if (!service || !selectedDate) return;
    // Resumed a finished booking: leave the restored selection alone.
    if (stepRef.current === "success") return;
    setLoading(true);
    setError(null);

    const monday = getMonday(new Date(selectedDate + "T12:00:00"));
    const mondayStr = formatDate(monday);
    getWeeklySchedule(mondayStr)
      .then((res) => {
        const day = res.days.find((d) => d.date === selectedDate);
        if (!day) {
          setDaySlots([]);
        } else {
          // sort by time like Google Calendar chronological
          const sorted = [...day.slots].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
          setDaySlots(sorted);
        }
      })
      .catch((e) => {
        setError(e.message);
        setDaySlots([]);
      })
      .finally(() => setLoading(false));
  }, [service, selectedDate]);

  // --- handlers ---
  function handleSlotSelect(slot: string) {
    setSelectedSlot(slot);
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
      setError(e instanceof Error ? e.message : "Booking failed");
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
    } catch (e: unknown) {
      setProofError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  // --- date options: next 14 days ---
  const dateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { value: formatDate(d), label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) };
  });

  const availableCount = daySlots.filter((s) => s.status === "available").length;
  const heldCount = daySlots.filter((s) => s.status === "held").length;
  const bookedCount = daySlots.filter((s) => s.status === "booked").length;

  return (
    <div className="min-h-[100dvh] bg-parchment text-espresso">
      <PublicNav />
      <NavSentinel />
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 pt-24 pb-16">
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

        {/* progress indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-espresso/55">
          {(["datetime", "info", "rules", "success"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-medium
                ${step === s ? "bg-accent-deep text-cream-ink" : "bg-espresso/10 text-espresso/60"}`}>
                {i + 1}
              </span>
              {i < 3 && <span className="w-4 h-px bg-espresso/15" />}
            </div>
          ))}
        </div>

        {/* error banner */}
        {error && (
          <div className="border border-red-800/25 bg-red-50 rounded-md px-4 py-2 text-sm text-red-900">
            {error}
          </div>
        )}

        {/* resume banner — left before uploading proof? pick up where you left off */}
        {stored && step !== "success" && (
          <Card className="border-bronze/40 bg-bronze/[0.08]">
            <CardContent className="flex flex-wrap items-center gap-3 py-3">
              <span className="rounded-lg bg-bronze/15 p-2 text-bronze">
                <History className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-espresso">
                  Unfinished booking found
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
                  Continue payment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 1: Date & Slot ─────────────────────── */}
        {step === "datetime" && (
          <Card className="border-espresso/10 bg-cream text-espresso shadow-[0_2px_16px_-8px_rgb(43_33_24/0.3)]">
            <CardHeader>
              <CardTitle>Pick a Date & Time</CardTitle>
              <CardDescription>
                {service?.name}, {service?.duration_minutes} min. Times in 12-hour format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* date selector */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Date</Label>
                <Select
                  value={selectedDate}
                  onValueChange={(v) => {
                    setSelectedDate(v ?? "");
                    // New date → drop the old time selection (unless it's the
                    // Schedule-prefilled slot for this load).
                    setSelectedSlot((prev) =>
                      preTime && prev === preTime ? prev : null,
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a date" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateOptions.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Google-style time slots — booked + available */}
              {selectedDate && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Available Times</Label>
                      {daySlots.length > 0 && (
                        <span className="text-[11px] text-espresso/60">
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-moss" /> {availableCount} free</span>
                          <span className="mx-1.5">·</span>
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bronze" /> {heldCount} held</span>
                          <span className="mx-1.5">·</span>
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-espresso/30" /> {bookedCount} booked</span>
                        </span>
                      )}
                    </div>

                    {loading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-[56px] bg-espresso/10 rounded-lg animate-pulse" />
                        ))}
                      </div>
                    ) : daySlots.length === 0 ? (
                        <div className="rounded-lg border border-espresso/10 bg-espresso/[0.03] p-6 text-center">
                          <p className="text-sm text-espresso/80">No slots for this date. The shop is closed.</p>
                          <p className="text-xs text-espresso/55 mt-1">Try another date or check the weekly schedule.</p>
                        </div>
                    ) : (
                    <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                      {/* Google Calendar-like vertical timeline */}
                      {daySlots.map((slot) => {
                        const isAvailable = slot.status === "available";
                        const isHeld = slot.status === "held";
                        const isSelected = selectedSlot === slot.time;
                        return (
                          <button
                            key={slot.time}
                            onClick={() => isAvailable && handleSlotSelect(slot.time)}
                            disabled={!isAvailable}
                            className={`w-full min-h-11 text-left rounded-lg border-l-[3px] px-3 py-2.5 flex items-center justify-between gap-3 transition-all
                              ${isSelected
                                ? "bg-accent-deep text-cream-ink border-l-brass-bright shadow-lg shadow-oxblood/30"
                                : isAvailable
                                  ? "bg-moss/[0.06] border-espresso/10 border-l-moss hover:bg-moss/15 hover:border-moss/40"
                                  : isHeld
                                    ? "bg-bronze/[0.07] border-bronze/25 border-l-bronze opacity-80 cursor-not-allowed"
                                    : "bg-espresso/[0.03] border-espresso/10 border-l-espresso/30 opacity-70 cursor-not-allowed"
                              }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium tabular-nums flex items-center gap-1.5 ${isSelected ? "text-cream-ink" : isAvailable ? "text-espresso" : isHeld ? "text-espresso/70" : "text-espresso/50"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAvailable ? "bg-moss" : isHeld ? "bg-bronze" : "bg-espresso/30"} ${isSelected ? "bg-cream-ink" : ""}`} />
                                {formatSlotRange(slot.time, service?.duration_minutes)}
                              </div>
                              <div className={`text-[11px] mt-0.5 ${isSelected ? "text-cream-ink/80" : isAvailable ? "text-moss" : isHeld ? "text-bronze" : "text-espresso/45"}`}>
                                {isAvailable
                                  ? `Available • ${service?.duration_minutes} min`
                                  : isHeld
                                    ? "Held • awaiting payment proof"
                                    : "Booked • unavailable"}
                              </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <Badge
                                variant="outline"
                                className={`text-[10px] h-5 border-0 ${isSelected ? "bg-cream-ink/25 text-cream-ink" : isAvailable ? "bg-moss/15 text-moss" : isHeld ? "bg-bronze/15 text-bronze" : "bg-espresso/10 text-espresso/55"}`}
                              >
                                {isAvailable ? "FREE" : isHeld ? "HELD" : "BOOKED"}
                              </Badge>
                              {isAvailable && !isSelected && <span className="text-[11px] text-moss font-medium">Tap to select →</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[11px] text-espresso/55 mt-2">Green means free. Bronze means held by another customer. Faded means booked.</p>
                </div>
              )}

              <Button variant="ghost" onClick={() => navigate("/schedule")} className="mt-2 text-espresso/70 hover:bg-espresso/5 hover:text-espresso">
                ← View weekly schedule
              </Button>
            </CardContent>
          </Card>
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
              <CardTitle className="flex items-center gap-2">
                <span>
                  {booking.payment_proof_url
                    ? "Proof Received"
                    : "Slot Reserved"}
                </span>
                <Badge className={getStatusBadge(booking.status)}>
                  {booking.status === "pending"
                    ? booking.payment_proof_url
                      ? "AWAITING REVIEW"
                      : "AWAITING PROOF"
                    : booking.status.toUpperCase()}
                </Badge>
              </CardTitle>
              <CardDescription>
                Booking ID: <code className="text-xs">{booking.id}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-bronze/40 bg-bronze/[0.08] px-4 py-3 text-sm">
                <p className="font-semibold text-bronze">
                  Reservation held. Present this code at check-in
                </p>
                <p className="mt-1 font-mono text-lg font-bold tracking-wide text-espresso tabular-nums">
                  {booking.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="mt-1 text-espresso/70">
                  {selectedDate} ·{" "}
                  {selectedSlot
                    ? formatSlotRange(selectedSlot, service?.duration_minutes)
                    : ""}
                </p>
              </div>

              <div className="bg-bronze/[0.08] border border-bronze/40 rounded-md px-4 py-3 text-sm">
                {booking.payment_proof_url ? (
                  <>
                    <p className="font-medium text-moss">✓ Proof uploaded</p>
                    <p className="text-espresso/75 mt-1">
                      Your slot is held. The owner will verify your GCash
                      payment and confirm your booking — no further action
                      needed from you.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-bronze">⚠ Payment Required</p>
                    <p className="text-espresso/75 mt-1">
                      Your slot is held for 15 minutes. Send the downpayment
                      via GCash and upload your proof of payment below to keep
                      it — the hold lifts once your proof is in, and the owner
                      confirms your booking after verifying payment.
                    </p>
                  </>
                )}
              </div>

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
                  <span className="text-espresso/55">Payment Status</span>
                  <Badge variant="outline" className="capitalize border-espresso/20 text-espresso">
                    {booking.downpayment_status.replace("_", " ")}
                  </Badge>
                </div>
              </div>

              <Separator className="bg-espresso/10" />

              {/* proof upload */}
              <div className="space-y-2">
                <Label htmlFor="proof-file" className="text-sm font-medium">Upload Payment Proof</Label>
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
                {booking.payment_proof_url && (
                  <p className="text-xs text-moss">
                    ✓ Proof uploaded — your slot is held while the owner verifies payment.
                  </p>
                )}
              </div>

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
                  }}
                >
                  Book Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <p className="text-center text-xs text-espresso/50">
          Downpayment required to confirm · No downpayment, no appointment
        </p>
      </div>
      <PublicFooter />
    </div>
  );
}
