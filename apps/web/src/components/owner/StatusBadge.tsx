import { cn } from "@/lib/utils";
import { STATUS_STYLES, displayStatusLabel } from "./bookingStatus";

/**
 * Single source of truth for booking status pills (owner + customer UI).
 * Replaces the three duplicated inline StatusBadge implementations.
 */
export default function StatusBadge({
  status,
  proofUrl,
  className,
}: {
  status: string;
  /** When set and status is pending, shows AWAITING REVIEW vs AWAITING PROOF. */
  proofUrl?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        STATUS_STYLES[status] ?? "bg-espresso/10 text-espresso/60 border-espresso/20",
        className,
      )}
    >
      {displayStatusLabel(status, proofUrl)}
    </span>
  );
}
