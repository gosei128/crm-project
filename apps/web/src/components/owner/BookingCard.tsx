import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Eye, FileText, Phone, Trash2, User, Users, Receipt } from "lucide-react";
import { useEffect } from "react";
import type { Booking } from "@/lib/api";
import { formatDateTime, formatSlotRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useConfirmTap } from "@/hooks/useConfirmTap";
import BookingActions from "./BookingActions";
import StatusBadge from "./StatusBadge";
import { STATUS_ACCENT, TERMINAL_STATUSES } from "./bookingStatus";

function MetaRow({
  icon: Icon,
  children,
}: {
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-espresso/70">
      <Icon className="h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export default function BookingCard({
  booking: b,
  serviceName = "Haircut",
  durationMinutes,
  actionLoading,
  onConfirmPayment,
  onMarkArrived,
  onMarkComplete,
  onMarkNoShow,
  onCancel,
  onDelete,
  onViewProof,
  onViewDetails,
}: {
  booking: Booking;
  serviceName?: string;
  durationMinutes?: number;
  actionLoading: string | null;
  onConfirmPayment: (b: Booking) => void;
  onMarkArrived: (b: Booking) => void;
  onMarkComplete: (b: Booking) => void;
  onMarkNoShow: (b: Booking) => void;
  onCancel: (b: Booking) => void;
  onDelete: (b: Booking) => void;
  onViewProof: (b: Booking) => void;
  onViewDetails: (b: Booking) => void;
}) {
  const { armed, tap, reset } = useConfirmTap();
  useEffect(() => {
    reset();
  }, [b.id, reset]);
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="flex p-0">
        <div
          className={cn(
            "w-1 shrink-0 self-stretch",
            STATUS_ACCENT[b.status] ?? "bg-espresso/30",
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{serviceName}</span>
                <StatusBadge status={b.status} proofUrl={b.payment_proof_url} />
                <Badge variant="outline" className="text-xs capitalize">
                  {b.downpayment_status.replace(/_/g, " ")}
                </Badge>
              </div>

              <MetaRow icon={Clock}>
                <span className="font-medium text-espresso tabular-nums">
                  {formatSlotRange(b.slot_start, durationMinutes)}
                </span>{" "}
                <span className="text-brass">·</span>{" "}
                {new Date(b.slot_start).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </MetaRow>

              {(b.customer_name || b.customer_phone) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-espresso/70">
                  {b.customer_name && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
                      <span className="truncate">{b.customer_name}</span>
                    </span>
                  )}
                  {b.customer_phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
                      <span className="tabular-nums">{b.customer_phone}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
                    {b.pax} {b.pax === 1 ? "person" : "people"}
                  </span>
                </div>
              )}

              {b.notes && (
                <p className="inline-flex max-w-full items-start gap-1.5 rounded bg-espresso/[0.04] px-2 py-1 text-xs text-espresso/60 italic">
                  <FileText className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="break-words">“{b.notes}”</span>
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Created {formatDateTime(b.created_at)}
                {b.arrival_time && (
                  <span>
                    {" "}
                    · Arrived{" "}
                    {new Date(b.arrival_time).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                )}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-start gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onViewDetails(b)}
                aria-label={`View details for booking by ${b.customer_name ?? "customer"}`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                View
              </Button>
              {TERMINAL_STATUSES.has(b.status) && (
                <Button
                  size="sm"
                  variant={armed ? "destructive" : "ghost"}
                  className={cn("h-7 text-xs", armed && "px-2.5")}
                  disabled={actionLoading !== null}
                  onClick={() => tap(() => onDelete(b))}
                  title="Delete this record permanently"
                  aria-label={
                    armed
                      ? "Tap again to delete this booking permanently"
                      : `Delete booking by ${b.customer_name ?? "customer"}`
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {armed ? "Sure?" : <span className="sr-only">Delete</span>}
                </Button>
              )}
              <BookingActions
                booking={b}
                actionLoading={actionLoading}
                onConfirmPayment={onConfirmPayment}
                onMarkArrived={onMarkArrived}
                onMarkComplete={onMarkComplete}
                onMarkNoShow={onMarkNoShow}
                onCancel={onCancel}
              />
            </div>
          </div>

          {b.payment_proof_url && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                GCash proof attached
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onViewProof(b)}
              >
                View proof
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
