import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CircleAlert, RefreshCw, Search, SearchX, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BookingCard from "@/components/owner/BookingCard";
import BookingDetailsModal from "@/components/owner/BookingDetailsModal";
import EmptyState from "@/components/owner/EmptyState";
import ProofPreview from "@/components/owner/ProofPreview";
import { useOwnerBookings } from "@/hooks/useOwnerBookings";
import {
  getSingletonService,
  ownerConfirmPayment,
  ownerMarkArrived,
  ownerMarkComplete,
  ownerMarkNoShow,
  type Booking,
} from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "booked", label: "Booked" },
  { value: "complete", label: "Complete" },
  { value: "expired", label: "Expired" },
  { value: "cancelled_no_show", label: "Cancelled (no-show)" },
  { value: "cancelled_late", label: "Cancelled (late)" },
];

const VALID_STATUSES = new Set(STATUS_OPTIONS.map((o) => o.value));

export default function Bookings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramStatus = searchParams.get("status") ?? "all";

  const [statusFilter, setStatusFilter] = useState(
    VALID_STATUSES.has(paramStatus) ? paramStatus : "all",
  );
  const [dateFilter, setDateFilter] = useState("");
  const [query, setQuery] = useState("");
  const [deferredQuery, setDeferredQuery] = useState("");
  const [preview, setPreview] = useState<Booking | null>(null);
  const [detailsBooking, setDetailsBooking] = useState<Booking | null>(null);
  const [serviceName, setServiceName] = useState("Haircut");
  const [duration, setDuration] = useState<number | undefined>(undefined);

  // Debounce text search (client-side; no backend `q` param in v1).
  useEffect(() => {
    const t = setTimeout(() => setDeferredQuery(query.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Stay in sync with `?status=` deep-links (e.g. from Dashboard stat cards)
  // even when this route is already mounted — render-time adjustment,
  // the recommended alternative to syncing props in an effect.
  const [prevParamStatus, setPrevParamStatus] = useState(paramStatus);
  if (paramStatus !== prevParamStatus) {
    setPrevParamStatus(paramStatus);
    setStatusFilter(VALID_STATUSES.has(paramStatus) ? paramStatus : "all");
  }

  useEffect(() => {
    getSingletonService()
      .then((s) => {
        setServiceName(s.name);
        setDuration(s.duration_minutes);
      })
      .catch(() => {});
  }, []);

  const { bookings, loading, error, actionLoading, refresh, runAction } =
    useOwnerBookings({ status: statusFilter, date: dateFilter });

  /** Run an action from the details modal, then refresh the modal in place. */
  async function handleModalAction(b: Booking, fn: () => Promise<Booking>) {
    const updated = await runAction(b.id, fn);
    if (updated) setDetailsBooking(updated);
  }

  const filtered = useMemo(() => {
    if (!deferredQuery) return bookings;
    return bookings.filter((b) =>
      [b.customer_name, b.customer_phone, b.notes, b.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [bookings, deferredQuery]);

  function handleStatusChange(v: string) {
    const next = v ?? "all";
    setStatusFilter(next);
    setSearchParams(next === "all" ? {} : { status: next }, { replace: true });
  }

  function clearFilters() {
    setStatusFilter("all");
    setDateFilter("");
    setQuery("");
    setDeferredQuery("");
    setSearchParams({}, { replace: true });
  }

  const hasActiveFilters =
    statusFilter !== "all" || dateFilter !== "" || query.trim() !== "";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-6">
      <div className="flex animate-enter flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Every appointment, filterable by status and date.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      <Card className="animate-enter-1">
        <CardHeader>
          <CardTitle className="text-sm">Find bookings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="booking-search" className="text-xs">
              Search
            </Label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="booking-search"
                type="search"
                placeholder="Name, phone, or booking ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pr-8 pl-9"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="booking-status" className="text-xs">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger id="booking-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="booking-date" className="text-xs">
                Date
              </Label>
              <Input
                id="booking-date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
              {loading
                ? "Loading…"
                : `${filtered.length} ${filtered.length === 1 ? "booking" : "bookings"}`}
            </p>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3" aria-label="Loading bookings">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="motion-reduce:animate-none">
              <CardContent className="animate-pulse py-4">
                <div className="mb-2 h-5 w-32 rounded bg-slate-100" />
                <div className="h-3 w-full rounded bg-slate-100" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-10 w-10" aria-hidden="true" />}
          title={
            bookings.length === 0 && !hasActiveFilters
              ? "No bookings yet"
              : "No bookings match"
          }
          description={
            bookings.length === 0 && !hasActiveFilters
              ? "New client bookings will appear here."
              : "Try a different search term or clear the filters."
          }
          actionLabel={hasActiveFilters ? "Clear filters" : undefined}
          onAction={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((b, i) => (
            <div
              key={b.id}
              className="animate-enter"
              style={{ animationDelay: `${Math.min(i, 5) * 40}ms` }}
            >
              <BookingCard
                booking={b}
                serviceName={serviceName}
                durationMinutes={duration}
                actionLoading={actionLoading}
                onConfirmPayment={(x) =>
                  void runAction(x.id, () => ownerConfirmPayment(x.id))
                }
                onMarkArrived={(x) =>
                  void runAction(x.id, () => ownerMarkArrived(x.id))
                }
                onMarkComplete={(x) =>
                  void runAction(x.id, () => ownerMarkComplete(x.id))
                }
                onMarkNoShow={(x) =>
                  void runAction(x.id, () => ownerMarkNoShow(x.id))
                }
                onViewProof={setPreview}
                onViewDetails={setDetailsBooking}
              />
            </div>
          ))}
        </div>
      )}

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
