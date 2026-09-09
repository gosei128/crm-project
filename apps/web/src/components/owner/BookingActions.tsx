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
  className,
}: {
  booking: Booking;
  actionLoading: string | null;
  onConfirmPayment: (b: Booking) => void;
  onMarkArrived: (b: Booking) => void;
  onMarkComplete: (b: Booking) => void;
  onMarkNoShow: (b: Booking) => void;
  className?: string;
}) {
  const busy = actionLoading === b.id;
  const disableAll = actionLoading !== null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {b.status === "pending" && (
        <Button
          size="sm"
          className="h-7 text-xs active:scale-95"
          disabled={disableAll}
          onClick={() => onConfirmPayment(b)}
        >
          {busy ? "Confirming…" : "Confirm Payment"}
        </Button>
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
            {busy ? "Saving…" : "Mark Complete"}
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
