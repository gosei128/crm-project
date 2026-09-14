import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Phone,
  Receipt,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type { Booking } from "@/lib/api";
import { formatDateTime, formatSlotRange } from "@/lib/format";
import { isImageUrl } from "@/lib/media";
import { useConfirmTap } from "@/hooks/useConfirmTap";
import { TERMINAL_STATUSES } from "./bookingStatus";
import BookingActions from "./BookingActions";
import StatusBadge from "./StatusBadge";

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-medium break-words">{children}</div>
      </div>
    </div>
  );
}

/**
 * Owner booking inspector: full details + GCash proof check + status
 * actions in one centered modal. The parent keeps passing the latest
 * booking object so the modal refreshes in place after each action.
 */
export default function BookingDetailsModal({
  booking,
  serviceName = "Haircut",
  durationMinutes,
  actionLoading,
  onClose,
  onConfirmPayment,
  onMarkArrived,
  onMarkComplete,
  onMarkNoShow,
  onCancel,
  onDelete,
}: {
  booking: Booking | null;
  serviceName?: string;
  durationMinutes?: number;
  actionLoading: string | null;
  onClose: () => void;
  onConfirmPayment: (b: Booking) => void;
  onMarkArrived: (b: Booking) => void;
  onMarkComplete: (b: Booking) => void;
  onMarkNoShow: (b: Booking) => void;
  onCancel: (b: Booking) => void;
  onDelete: (b: Booking) => void;
}) {
  // Track *which* booking was copied — resets per booking, no effect needed.
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopyId() {
    if (!booking) return;
    try {
      await navigator.clipboard.writeText(booking.id);
      setCopiedId(booking.id);
    } catch {
      setCopiedId(null);
    }
  }

  const trimmedProof = booking?.payment_proof_url?.trim();
  const proofUrl = trimmedProof ? trimmedProof : null;

  const { armed, tap, reset } = useConfirmTap();
  useEffect(() => {
    reset();
  }, [booking?.id, reset]);

  return (
    <Dialog
      open={booking !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        {booking && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>{serviceName}</DialogTitle>
                <StatusBadge status={booking.status} proofUrl={booking.payment_proof_url} />
                <Badge variant="outline" className="text-xs capitalize">
                  {booking.downpayment_status.replace(/_/g, " ")}
                </Badge>
              </div>
              <DialogDescription className="tabular-nums">
                {new Date(booking.slot_start).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}{" "}
                · {formatSlotRange(booking.slot_start, durationMinutes)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailRow icon={User} label="Customer">
                  {booking.customer_name ?? "Not given"}
                </DetailRow>
                <DetailRow icon={Phone} label="Phone">
                  <span className="tabular-nums">
                    {booking.customer_phone ?? "Not given"}
                  </span>
                </DetailRow>
                <DetailRow icon={Users} label="Party size">
                  {booking.pax} {booking.pax === 1 ? "person" : "people"}
                </DetailRow>
                <DetailRow icon={CalendarDays} label="Booked at">
                  <span className="tabular-nums">
                    {formatDateTime(booking.created_at)}
                  </span>
                </DetailRow>
              </div>

              {booking.notes && (
                <div className="flex items-start gap-2.5">
                  <FileText
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="mt-0.5 rounded bg-muted/60 px-2 py-1 text-sm break-words italic">
                      “{booking.notes}”
                    </p>
                  </div>
                </div>
              )}

              {booking.arrival_time && (
                <DetailRow icon={Clock} label="Arrived at">
                  <span className="tabular-nums">
                    {new Date(booking.arrival_time).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </DetailRow>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="shrink-0">Booking ID</span>
                <code className="min-w-0 flex-1 truncate rounded bg-muted/60 px-1.5 py-0.5 tabular-nums">
                  {booking.id}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyId()}
                  aria-label="Copy booking ID"
                  className="rounded p-1 transition-colors hover:bg-muted hover:text-foreground"
                >
                  {copiedId === booking.id ? (
                    <Check className="h-3.5 w-3.5 text-moss" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                  GCash payment proof
                </p>
                {proofUrl ? (
                  isImageUrl(proofUrl) ? (
                    <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={proofUrl}
                        alt="GCash payment proof uploaded by customer"
                        className="max-h-64 w-full rounded-lg border object-contain"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <a
                      href={proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border p-3 text-xs break-all text-oxblood hover:underline"
                    >
                      {proofUrl}
                    </a>
                  )
                ) : (
                  <p
                    className={
                      booking.status === "pending"
                        ? "rounded-md border border-bronze/40 bg-bronze/[0.08] px-3 py-2 text-sm text-bronze"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {booking.status === "pending"
                      ? "No proof uploaded yet. Confirm payment only after verifying GCash."
                      : "No proof was attached to this booking."}
                  </p>
                )}
                {proofUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    render={
                      <a href={proofUrl} target="_blank" rel="noopener noreferrer" />
                    }
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Open proof
                  </Button>
                )}
              </div>
            </div>

            <DialogFooter className="items-stretch sm:items-center">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              {TERMINAL_STATUSES.has(booking.status) && (
                <Button
                  variant={armed ? "destructive" : "ghost"}
                  onClick={() => tap(() => onDelete(booking))}
                  disabled={actionLoading !== null}
                  title="Delete this record permanently"
                  aria-label={
                    armed
                      ? "Tap again to delete this booking permanently"
                      : "Delete this booking"
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {armed ? "Sure?" : "Delete"}
                </Button>
              )}
              <BookingActions
                booking={booking}
                actionLoading={actionLoading}
                onConfirmPayment={onConfirmPayment}
                onMarkArrived={onMarkArrived}
                onMarkComplete={onMarkComplete}
                onMarkNoShow={onMarkNoShow}
                onCancel={onCancel}
                className="flex-1 sm:flex-none"
              />
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
