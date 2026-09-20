import { Badge } from "@/components/ui/badge";
import type { DaySlotAvailability } from "@/lib/api";
import { formatCountdown, useCountdown } from "./useCountdown";

export interface DaySlotPanelProps {
  date: string;
  slots: DaySlotAvailability[];
  selectedSlot: string | null;
  /** Slot the current user just put on hold — shows live expiry countdown. */
  ownPendingSlot?: string | null;
  isLoading?: boolean;
  isShopOpen?: boolean;
  durationMinutes?: number;
  onSelectSlot: (time: string) => void;
  onExpiredHold?: () => void;
}

function formatRange(iso: string, durationMinutes?: number): string {
  const start = new Date(iso);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (!durationMinutes) return fmt(start);
  return `${fmt(start)} - ${fmt(new Date(start.getTime() + durationMinutes * 60000))}`;
}

function SlotCountdown({ expiresAt, onExpired }: { expiresAt: string; onExpired?: () => void }) {
  const secondsLeft = useCountdown(expiresAt);
  // Fire once when the hold lapses so the parent can refetch the day.
  if (secondsLeft === 0 && onExpired) {
    // Defer to avoid set-state-during-render warnings.
    const cb = onExpired;
    setTimeout(cb, 0);
  }
  if (secondsLeft === null) return null;
  const urgent = secondsLeft < 120;
  return (
    <span
      className={`font-mono text-[11px] font-bold tabular-nums ${urgent ? "text-oxblood" : "text-bronze"}`}
      aria-live="polite"
    >
      hold expires in {formatCountdown(secondsLeft)}
    </span>
  );
}

/** Day slot list — purely presentational. Renders backend-provided
 *  status verbatim; expiry countdown is display-only. */
export default function DaySlotPanel({
  date,
  slots,
  selectedSlot,
  ownPendingSlot = null,
  isLoading = false,
  isShopOpen = true,
  durationMinutes,
  onSelectSlot,
  onExpiredHold,
}: DaySlotPanelProps) {
  const available = slots.filter((s) => s.status === "available").length;
  const pending = slots.filter((s) => s.status === "pending").length;
  const booked = slots.filter((s) => s.status === "booked").length;

  const prettyDate = (() => {
    try {
      return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    } catch {
      return date;
    }
  })();

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-espresso tabular-nums">{prettyDate}</p>
        {slots.length > 0 && (
          <span className="text-[11px] text-espresso/60">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-moss" /> {available} free
            </span>
            <span className="mx-1.5">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-bronze" /> {pending} pending
            </span>
            <span className="mx-1.5">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-espresso/30" /> {booked} booked
            </span>
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2" aria-label="Loading slots">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[56px] animate-pulse rounded-lg bg-espresso/10" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="mt-3 rounded-lg border border-espresso/10 bg-espresso/[0.03] p-6 text-center">
          <p className="text-sm text-espresso/80">No slots for this date. The shop is closed.</p>
          <p className="mt-1 text-xs text-espresso/55">Pick a highlighted day on the calendar.</p>
        </div>
      ) : (
        <div className="mt-3 max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {slots.map((slot) => {
            const isAvailable = slot.status === "available" && isShopOpen;
            const isPending = slot.status === "pending";
            const isSelected = selectedSlot === slot.time;
            const isOwnHold = ownPendingSlot === slot.time;
            return (
              <button
                key={slot.time}
                type="button"
                onClick={() => isAvailable && onSelectSlot(slot.time)}
                disabled={!isAvailable}
                aria-pressed={isSelected}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-left transition-all
                  ${
                    isSelected
                      ? "border-l-brass-bright bg-accent-deep text-cream-ink shadow-lg shadow-oxblood/30"
                      : isAvailable
                        ? "border-espresso/10 border-l-moss bg-moss/[0.06] hover:border-moss/40 hover:bg-moss/15"
                        : isPending
                          ? "cursor-not-allowed border-bronze/25 border-l-bronze bg-bronze/[0.07] opacity-80"
                          : "cursor-not-allowed border-espresso/10 border-l-espresso/30 bg-espresso/[0.03] opacity-70"
                  }`}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className={`flex items-center gap-1.5 text-sm font-medium tabular-nums ${
                      isSelected
                        ? "text-cream-ink"
                        : isAvailable
                          ? "text-espresso"
                          : isPending
                            ? "text-espresso/70"
                            : "text-espresso/50"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        isAvailable ? "bg-moss" : isPending ? "bg-bronze" : "bg-espresso/30"
                      } ${isSelected ? "bg-cream-ink" : ""}`}
                    />
                    {formatRange(slot.time, durationMinutes)}
                  </div>
                  <div
                    className={`mt-0.5 text-[11px] ${
                      isSelected
                        ? "text-cream-ink/80"
                        : isAvailable
                          ? "text-moss"
                          : isPending
                            ? "text-bronze"
                            : "text-espresso/45"
                    }`}
                  >
                    {isAvailable ? (
                      `Available • ${durationMinutes ?? ""} min`.replace(" •  min", "")
                    ) : isPending ? (
                      isOwnHold && slot.expires_at ? (
                        <SlotCountdown expiresAt={slot.expires_at} onExpired={onExpiredHold} />
                      ) : (
                        "Pending • awaiting downpayment"
                      )
                    ) : (
                      "Booked • unavailable"
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge
                    variant="outline"
                    className={`h-5 border-0 text-[10px] ${
                      isSelected
                        ? "bg-cream-ink/25 text-cream-ink"
                        : isAvailable
                          ? "bg-moss/15 text-moss"
                          : isPending
                            ? "bg-bronze/15 text-bronze"
                            : "bg-espresso/10 text-espresso/55"
                    }`}
                  >
                    {isAvailable ? "FREE" : isPending ? "PENDING" : "BOOKED"}
                  </Badge>
                  {isAvailable && !isSelected && (
                    <span className="text-[11px] font-medium text-moss">Tap to select →</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-[11px] text-espresso/55">
        Green means free. Bronze means another customer's downpayment is pending. Faded means
        booked.
      </p>
    </div>
  );
}
