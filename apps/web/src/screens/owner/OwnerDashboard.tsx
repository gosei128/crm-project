import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleAlert, Eye, Store } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import BookingCard from "@/components/owner/BookingCard";
import BookingDetailsModal from "@/components/owner/BookingDetailsModal";
import EmptyState from "@/components/owner/EmptyState";
import ProofPreview from "@/components/owner/ProofPreview";
import StatCard from "@/components/owner/StatCard";
import {
  getShopStatus,
  getSingletonService,
  ownerConfirmPayment,
  ownerListBookings,
  ownerMarkArrived,
  ownerMarkComplete,
  ownerMarkNoShow,
  type Booking,
} from "@/lib/api";
import { formatSlotTime, todayYYYYMMDD } from "@/lib/format";

function timeAgo(iso: string): string {
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [today, setToday] = useState<Booking[]>([]);
  const [pending, setPending] = useState<Booking[]>([]);
  const [shopOpen, setShopOpen] = useState(true);
  const [serviceName, setServiceName] = useState("Haircut");
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [preview, setPreview] = useState<Booking | null>(null);
  const [detailsBooking, setDetailsBooking] = useState<Booking | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayRes, pendingRes, shopRes, svcRes] = await Promise.all([
        ownerListBookings({ date: todayYYYYMMDD() }),
        ownerListBookings({ status: "pending" }),
        getShopStatus().catch(() => null),
        getSingletonService().catch(() => null),
      ]);
      setToday(todayRes);
      setPending(pendingRes);
      if (shopRes) setShopOpen(shopRes.is_open);
      if (svcRes) {
        setServiceName(svcRes.name);
        setDuration(svcRes.duration_minutes);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [todayRes, pendingRes, shopRes, svcRes] = await Promise.all([
          ownerListBookings({ date: todayYYYYMMDD() }),
          ownerListBookings({ status: "pending" }),
          getShopStatus().catch(() => null),
          getSingletonService().catch(() => null),
        ]);
        if (cancelled) return;
        setToday(todayRes);
        setPending(pendingRes);
        if (shopRes) setShopOpen(shopRes.is_open);
        if (svcRes) {
          setServiceName(svcRes.name);
          setDuration(svcRes.duration_minutes);
        }
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAction(
    id: string,
    fn: () => Promise<Booking>,
  ): Promise<Booking | null> {
    setActionLoading(id);
    setError(null);
    try {
      const updated = await fn();
      await refresh();
      return updated;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
      return null;
    } finally {
      setActionLoading(null);
    }
  }

  /** Run an action from the details modal, then refresh the modal in place. */
  async function handleModalAction(b: Booking, fn: () => Promise<Booking>) {
    const updated = await handleAction(b.id, fn);
    if (updated) setDetailsBooking(updated);
  }

  const awaitingProof = pending
    .filter((b) => b.payment_proof_url)
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const confirmedToday = today.filter((b) => b.status === "booked").length;
  const sortedToday = [...today].sort(
    (a, b) => +new Date(a.slot_start) - +new Date(b.slot_start),
  );

  return (
    <div className="mx-auto w-full  space-y-4 p-4 md:p-6">
      <div className="animate-enter">
        <h1 className="text-2xl font-bold tracking-tight">
          Good to see you, boss
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what needs your attention today.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!shopOpen && (
        <Alert className="animate-enter border-amber-200 bg-amber-50 text-amber-900">
          <Store aria-hidden="true" />
          <AlertTitle>Shop is closed</AlertTitle>
          <AlertDescription className="text-amber-800">
            New bookings are paused — existing appointments are still honored.{" "}
            <button
              className="font-medium underline underline-offset-2"
              onClick={() => navigate("/controls")}
            >
              Manage in Shop Controls
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid animate-enter-1 grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Today"
          value={today.length}
          sub={
            today.length === 0
              ? "No appointments"
              : `First at ${formatSlotTime(sortedToday[0].slot_start)}`
          }
          loading={loading}
          onClick={() => navigate("/bookings")}
          actionHint="View today's bookings"
        />
        <StatCard
          label="Needs payment"
          value={pending.length}
          sub={
            pending.length === 0 ? "All clear" : "Awaiting GCash confirmation"
          }
          accent="amber"
          loading={loading}
          onClick={() => navigate("/bookings?status=pending")}
          actionHint="View pending payments"
        />
        <StatCard
          label="Confirmed today"
          value={confirmedToday}
          sub="Booked slots"
          accent="blue"
          loading={loading}
          onClick={() => navigate("/bookings?status=booked")}
          actionHint="View confirmed bookings"
        />
        <StatCard
          label="Proofs to review"
          value={awaitingProof.length}
          sub={
            awaitingProof.length === 0
              ? "Nothing waiting"
              : "Oldest first — verify in GCash"
          }
          accent={awaitingProof.length > 0 ? "rose" : "emerald"}
          loading={loading}
          onClick={() => navigate("/bookings?status=pending")}
          actionHint="View proofs to review"
        />
      </div>

      <Card className="animate-enter-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">
            Needs action{" "}
            <span
              className="ml-1 font-normal text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {awaitingProof.length} waiting
            </span>
          </CardTitle>
          {awaitingProof.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 bg-accent text-xs"
              onClick={() => navigate("/bookings?status=pending")}
            >
              View all
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <>
              <Skeleton className="h-16 w-full motion-reduce:animate-none" />
              <Skeleton className="h-16 w-full motion-reduce:animate-none" />
            </>
          ) : awaitingProof.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {pending.length === 0
                ? "No pending payments. New bookings will show up here."
                : "No proofs uploaded yet — pending bookings expire 15 minutes after creation."}
            </p>
          ) : (
            awaitingProof.slice(0, 5).map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition-colors duration-200 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {b.customer_name ?? "Customer"}
                    <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                      {formatSlotTime(b.slot_start)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.pax} {b.pax === 1 ? "person" : "people"} · waiting{" "}
                    {timeAgo(b.created_at)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 px-0"
                    aria-label={`View details for booking by ${b.customer_name ?? "customer"}`}
                    onClick={() => setDetailsBooking(b)}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setPreview(b)}
                  >
                    Proof
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs active:scale-95"
                    disabled={actionLoading !== null}
                    onClick={() =>
                      void handleAction(b.id, () => ownerConfirmPayment(b.id))
                    }
                  >
                    {actionLoading === b.id ? "Confirming…" : "Confirm"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="animate-enter-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Today&apos;s timeline{" "}
            <span className="font-normal text-muted-foreground">
              · {sortedToday.length}{" "}
              {sortedToday.length === 1 ? "booking" : "bookings"}
            </span>
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigate("/bookings")}
          >
            All bookings
          </Button>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="motion-reduce:animate-none">
                <CardContent className="animate-pulse py-4">
                  <div className="mb-2 h-5 w-32 rounded bg-slate-100" />
                  <div className="h-3 w-full rounded bg-slate-100" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedToday.length === 0 ? (
          <EmptyState
            title="No appointments today"
            description="When clients book, their slots will appear here in time order."
            actionLabel="View all bookings"
            onAction={() => navigate("/bookings")}
          />
        ) : (
          sortedToday.map((b) => (
            <div key={b.id} className="flex items-stretch gap-3">
              <div className="flex w-16 shrink-0 flex-col items-end pt-4">
                <span className="text-xs font-semibold tabular-nums">
                  {formatSlotTime(b.slot_start)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <BookingCard
                  booking={b}
                  serviceName={serviceName}
                  durationMinutes={duration}
                  actionLoading={actionLoading}
                  onConfirmPayment={(x) =>
                    void handleAction(x.id, () => ownerConfirmPayment(x.id))
                  }
                  onMarkArrived={(x) =>
                    void handleAction(x.id, () => ownerMarkArrived(x.id))
                  }
                  onMarkComplete={(x) =>
                    void handleAction(x.id, () => ownerMarkComplete(x.id))
                  }
                  onMarkNoShow={(x) =>
                    void handleAction(x.id, () => ownerMarkNoShow(x.id))
                  }
                  onViewProof={setPreview}
                  onViewDetails={setDetailsBooking}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <ProofPreview booking={preview} onClose={() => setPreview(null)} />
      <BookingDetailsModal
        booking={detailsBooking}
        serviceName={serviceName}
        durationMinutes={duration}
        actionLoading={actionLoading}
        onClose={() => setDetailsBooking(null)}
        onConfirmPayment={(b) =>
          void handleModalAction(b, () => ownerConfirmPayment(b.id))
        }
        onMarkArrived={(b) =>
          void handleModalAction(b, () => ownerMarkArrived(b.id))
        }
        onMarkComplete={(b) =>
          void handleModalAction(b, () => ownerMarkComplete(b.id))
        }
        onMarkNoShow={(b) =>
          void handleModalAction(b, () => ownerMarkNoShow(b.id))
        }
      />
    </div>
  );
}
