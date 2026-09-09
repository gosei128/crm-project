import { useCallback, useEffect, useState } from "react";
import { ownerListBookings, type Booking } from "@/lib/api";

export interface BookingServerFilters {
  status: string;
  date: string;
}

/**
 * Shared owner bookings fetching: server-side status/date filters,
 * per-booking action loading, and manual refresh.
 * Text search stays client-side (no backend `q` param in v1).
 */
export function useOwnerBookings({ status, date }: BookingServerFilters) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, string> = {};
      if (status !== "all") filters.status = status;
      if (date) filters.date = date;
      const result = await ownerListBookings(filters);
      setBookings(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load bookings";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [status, date]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const filters: Record<string, string> = {};
        if (status !== "all") filters.status = status;
        if (date) filters.date = date;
        const result = await ownerListBookings(filters);
        if (!cancelled) setBookings(result);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load bookings";
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [status, date]);

  /** Run an owner action (confirm/arrive/complete/no-show), then refresh.
   *  Resolves with the updated booking so callers (e.g. a details modal)
   *  can refresh in place; null when the action failed. */
  async function runAction(
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
      const msg = e instanceof Error ? e.message : "Action failed";
      setError(msg);
      return null;
    } finally {
      setActionLoading(null);
    }
  }

  return { bookings, loading, error, setError, actionLoading, refresh, runAction };
}
