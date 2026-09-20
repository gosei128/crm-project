import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDayAvailability,
  getMonthAvailability,
} from "@/lib/api";
import CalendarGrid from "./CalendarGrid";
import DaySlotPanel from "./DaySlotPanel";

export interface SchedulingSectionProps {
  selectedDate: string;
  selectedSlot: string | null;
  /** Slot the current user just put on hold (for the live countdown). */
  ownPendingSlot?: string | null;
  serviceName?: string;
  serviceDurationMinutes?: number;
  takenSlotNotice: string | null;
  onSelectDate: (date: string) => void;
  onSelectSlot: (time: string) => void;
  onMonthChange: (month: string) => void;
  viewMonth: string;
}

function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Container that owns all scheduling fetching (TanStack Query) and
 *  holds selectedDate/selectedSlot state via callbacks. The calendar
 *  and slot panel stay purely presentational. */
export default function SchedulingSection({
  selectedDate,
  selectedSlot,
  ownPendingSlot = null,
  serviceName,
  serviceDurationMinutes,
  takenSlotNotice,
  onSelectDate,
  onSelectSlot,
  onMonthChange,
  viewMonth,
}: SchedulingSectionProps) {
  const queryClient = useQueryClient();

  const monthQuery = useQuery({
    queryKey: ["monthAvailability", viewMonth],
    queryFn: () => getMonthAvailability(viewMonth),
    staleTime: 30_000,
  });

  const dayQuery = useQuery({
    queryKey: ["dayAvailability", selectedDate],
    queryFn: () => getDayAvailability(selectedDate),
    enabled: !!selectedDate,
    staleTime: 15_000,
    // Another client's booking can flip a slot at any time — refetch
    // on focus and on a short interval while the panel is open.
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  // Keep the calendar month in sync when a date arrives from elsewhere
  // (Schedule deep-link ?date=&time=, resume banner).
  useEffect(() => {
    if (selectedDate && monthOf(selectedDate) !== viewMonth) {
      onMonthChange(monthOf(selectedDate));
    }
    // onMonthChange is a stable setState wrapper from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  return (
    <Card className="border-espresso/10 bg-cream text-espresso shadow-[0_2px_16px_-8px_rgb(43_33_24/0.3)]">
      <CardHeader>
        <CardTitle>Pick a Date &amp; Time</CardTitle>
        <CardDescription>
          {serviceName
            ? `${serviceName}, ${serviceDurationMinutes ?? ""} min. Times in 12-hour format`
            : "Times in 12-hour format"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {takenSlotNotice && (
          <div
            className="rounded-md border border-oxblood/30 bg-oxblood/[0.06] px-4 py-2 text-sm text-oxblood"
            role="alert"
          >
            {takenSlotNotice}
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          <CalendarGrid
            month={viewMonth}
            summaries={monthQuery.data?.days ?? []}
            selectedDate={selectedDate || null}
            isLoading={monthQuery.isLoading}
            onSelectDate={onSelectDate}
            onMonthChange={(m) => {
              // Month navigation clears the slot selection cleanly —
              // never leave a phantom selected slot from another month.
              onMonthChange(m);
            }}
          />
          <div className="border-t border-espresso/10 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            {selectedDate ? (
              <DaySlotPanel
                date={selectedDate}
                slots={dayQuery.data?.slots ?? []}
                selectedSlot={selectedSlot}
                ownPendingSlot={ownPendingSlot}
                isLoading={dayQuery.isLoading}
                isShopOpen={dayQuery.data?.is_open ?? true}
                durationMinutes={serviceDurationMinutes}
                onSelectSlot={onSelectSlot}
                onExpiredHold={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ["dayAvailability", selectedDate],
                  });
                  void queryClient.invalidateQueries({
                    queryKey: ["monthAvailability", viewMonth],
                  });
                }}
              />
            ) : (
              <div className="rounded-lg border border-espresso/10 bg-espresso/[0.03] p-6 text-center">
                <p className="text-sm text-espresso/80">Select a day on the calendar.</p>
                <p className="mt-1 text-xs text-espresso/55">
                  Bronze dots have pending downpayments · red dots are busy.
                </p>
              </div>
            )}
            {dayQuery.isError && selectedDate && (
              <p className="mt-2 text-xs text-red-700">
                Could not load slots for this day. Pick another day or try again.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
