import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Booking } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Contextual owner action buttons for a booking, shared by BookingCard and
 * BookingDetailsModal so the two can never drift apart.
 */
export default function BookingActions({
  booking: b,
  actionLoading,
  onConfirmPayment,
  onMarkArrived,
  onMarkComplete,
  onMarkNoShow,
  onCancel,
  className,
}: {
  booking: Booking;
  actionLoading: string | null;
  onConfirmPayment: (b: Booking) => void;
  onMarkArrived: (b: Booking) => void;
  onMarkComplete: (b: Booking) => void;
  onMarkNoShow: (b: Booking) => void;
  onCancel: (b: Booking) => void;
  className?: string;
}) {
  const busy = actionLoading === b.id;
  const disableAll = actionLoading !== null;

  // Two-tap guard for the destructive cancel: first tap arms, second fires.
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    setConfirmingCancel(false);
  }, [b.id, b.status]);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function handleCancelClick() {
    if (confirmingCancel) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      setConfirmingCancel(false);
      onCancel(b);
      return;
    }
    setConfirmingCancel(true);
    timer.current = window.setTimeout(() => setConfirmingCancel(false), 4000);
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {b.status === "pending" && (
        <>
          <Button
            size="sm"
            className="h-7 text-xs active:scale-95"
            disabled={disableAll}
            onClick={() => onConfirmPayment(b)}
          >
            {busy ? "Confirming…" : "Confirm Payment"}
          </Button>
          <Button
            size="sm"
            variant={confirmingCancel ? "destructive" : "outline"}
            className="h-7 text-xs active:scale-95"
            disabled={disableAll}
            onClick={handleCancelClick}
            title="Cancel this hold and free the slot"
          >
            {busy
              ? "Saving…"
              : confirmingCancel
                ? "Tap again to cancel"
                : "Cancel Booking"}
          </Button>
        </>
      )}
      {b.status === "booked" && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs active:scale-95"
            disabled={disableAll}
            onClick={() => onMarkArrived(b)}
          >
            {busy ? "Saving…" : "Mark Arrived"}
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs active:scale-95"
            disabled={disableAll}
            onClick={() => onMarkComplete(b)}
          >
            {busy ? "Saving…" : "Haircut Done"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs active:scale-95"
            disabled={disableAll}
            onClick={() => onMarkNoShow(b)}
          >
            No-Show
          </Button>
        </>
      )}
    </div>
  );
}
