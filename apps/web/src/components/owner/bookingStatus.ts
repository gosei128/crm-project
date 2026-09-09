/**
 * Booking status presentation tokens (shared constants — no components,
 * so Fast Refresh stays happy importing this anywhere).
 */

export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  booked: "bg-blue-100 text-blue-800 border-blue-200",
  complete: "bg-emerald-100 text-emerald-800 border-emerald-200",
  expired: "bg-slate-100 text-slate-500 border-slate-300",
  cancelled_no_show: "bg-rose-100 text-rose-700 border-rose-200",
  cancelled_late: "bg-rose-100 text-rose-700 border-rose-200",
};

/** Left-accent bar color per status (timeline/card edge). */
export const STATUS_ACCENT: Record<string, string> = {
  pending: "bg-amber-500",
  booked: "bg-blue-500",
  complete: "bg-emerald-500",
  expired: "bg-slate-300",
  cancelled_no_show: "bg-rose-500",
  cancelled_late: "bg-rose-500",
};

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").toUpperCase();
}
