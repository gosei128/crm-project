/**
 * Booking status presentation tokens (shared constants — no components,
 * so Fast Refresh stays happy importing this anywhere).
 */

export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-bronze/15 text-bronze border-bronze/30",
  booked: "bg-oxblood/10 text-oxblood border-oxblood/25",
  complete: "bg-moss/15 text-moss border-moss/30",
  expired: "bg-espresso/10 text-espresso/55 border-espresso/20",
  cancelled: "bg-oxblood/10 text-oxblood border-oxblood/25",
  cancelled_no_show: "bg-oxblood/10 text-oxblood border-oxblood/25",
  cancelled_late: "bg-oxblood/10 text-oxblood border-oxblood/25",
};

/** Left-accent bar color per status (timeline/card edge). */
export const STATUS_ACCENT: Record<string, string> = {
  pending: "bg-bronze",
  booked: "bg-oxblood",
  complete: "bg-moss",
  expired: "bg-espresso/30",
  cancelled: "bg-oxblood",
  cancelled_no_show: "bg-oxblood",
  cancelled_late: "bg-oxblood",
};

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").toUpperCase();
}

/** Records the owner may hard-delete (trash). Active holds and confirmed
 *  bookings are never deletable — cancel them first. */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "complete",
  "expired",
  "cancelled",
  "cancelled_no_show",
  "cancelled_late",
]);

/**
 * Customer/owner-facing label: a PENDING booking splits by proof state.
 * BOOKED appears only after the owner's confirm-payment tap.
 */
export function displayStatusLabel(
  status: string,
  paymentProofUrl?: string | null,
): string {
  if (status === "pending") {
    return paymentProofUrl?.trim() ? "AWAITING REVIEW" : "AWAITING PROOF";
  }
  return statusLabel(status);
}
