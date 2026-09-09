import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Eye, FileText, Phone, User, Users, Receipt } from "lucide-react";
import type { Booking } from "@/lib/api";
import { formatDateTime, formatSlotRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import BookingActions from "./BookingActions";
import StatusBadge from "./StatusBadge";
import { STATUS_ACCENT } from "./bookingStatus";

function MetaRow({
  icon: Icon,
  children,
}: {
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
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
  onViewProof: (b: Booking) => void;
  onViewDetails: (b: Booking) => void;
}) {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="flex p-0">
        <div
          className={cn(
            "w-1 shrink-0 self-stretch",
            STATUS_ACCENT[b.status] ?? "bg-slate-300",
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{serviceName}</span>
                <StatusBadge status={b.status} />
                <Badge variant="outline" className="text-xs capitalize">
                  {b.downpayment_status.replace(/_/g, " ")}
                </Badge>
              </div>

              <MetaRow icon={Clock}>
                <span className="font-medium text-slate-900 tabular-nums">
                  {formatSlotRange(b.slot_start, durationMinutes)}
                </span>{" "}
                <span className="text-slate-400">·</span>{" "}
                {new Date(b.slot_start).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </MetaRow>

              {(b.customer_name || b.customer_phone) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                  {b.customer_name && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="truncate">{b.customer_name}</span>
                    </span>
                  )}
                  {b.customer_phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="tabular-nums">{b.customer_phone}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    {b.pax} {b.pax === 1 ? "person" : "people"}
                  </span>
                </div>
              )}

              {b.notes && (
                <p className="inline-flex max-w-full items-start gap-1.5 rounded bg-slate-50 px-2 py-1 text-xs text-slate-500 italic">
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
              <BookingActions
                booking={b}
                actionLoading={actionLoading}
                onConfirmPayment={onConfirmPayment}
                onMarkArrived={onMarkArrived}
                onMarkComplete={onMarkComplete}
                onMarkNoShow={onMarkNoShow}
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
