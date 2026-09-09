import { cn } from "@/lib/utils";
import { STATUS_STYLES, statusLabel } from "./bookingStatus";

/**
 * Single source of truth for booking status pills (owner + customer UI).
 * Replaces the three duplicated inline StatusBadge implementations.
 */
export default function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 border-slate-200",
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
