import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MonthDaySummary } from "@/lib/api";

export interface CalendarGridProps {
  /** "YYYY-MM" currently in view. */
  month: string;
  /** Per-day summary from GET /availability?month= — drives dots. */
  summaries: MonthDaySummary[];
  selectedDate: string | null;
  isLoading?: boolean;
  onSelectDate: (date: string) => void;
  onMonthChange: (month: string) => void;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** Month calendar grid — purely presentational. Renders whatever the
 *  backend month-summary says; never derives status itself. */
export default function CalendarGrid({
  month,
  summaries,
  selectedDate,
  isLoading = false,
  onSelectDate,
  onMonthChange,
}: CalendarGridProps) {
  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay(); // 0 = Sun
  const byDate = new Map(summaries.map((s) => [s.date, s]));
  const today = todayStr();
  const daysInMonth = new Date(y, m, 0).getDate();

  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous month"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          className="border-espresso/20 bg-transparent text-espresso hover:bg-espresso/5 hover:text-espresso"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-espresso" aria-live="polite">
            {monthLabel(month)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-0.5 h-5 text-xs text-oxblood hover:bg-brass/10 hover:text-brass-deep"
            onClick={() => {
              const now = new Date();
              onMonthChange(
                `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
              );
            }}
          >
            Go to today
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next month"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          className="border-espresso/20 bg-transparent text-espresso hover:bg-espresso/5 hover:text-espresso"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div
        className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-espresso/50"
        aria-hidden="true"
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label={monthLabel(month)}>
        {cells.map((dateStr, i) => {
          if (!dateStr) return <span key={`blank-${i}`} />;
          const summary = byDate.get(dateStr);
          const isPast = dateStr < today;
          const isClosed = summary?.is_closed ?? false;
          const disabled = isPast || isClosed || isLoading;
          const isSelected = selectedDate === dateStr;
          const dayNum = Number(dateStr.slice(8));
          return (
            <button
              key={dateStr}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-disabled={disabled}
              title={
                isPast
                  ? "Past day — not bookable"
                  : isClosed
                    ? "Shop closed this day"
                    : undefined
              }
              disabled={disabled}
              onClick={() => onSelectDate(dateStr)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg border px-1 py-1 text-xs transition-colors
                ${
                  isSelected
                    ? "border-accent-deep bg-accent-deep font-bold text-cream-ink"
                    : disabled
                      ? "cursor-not-allowed border-espresso/10 bg-espresso/[0.04] text-espresso/35 line-through decoration-espresso/25"
                      : "border-espresso/15 bg-cream font-medium text-espresso hover:border-moss/50 hover:bg-moss/[0.08]"
                }`}
            >
              <span className="tabular-nums">{dayNum}</span>
              <span className="mt-0.5 flex h-1.5 items-center gap-1" aria-hidden="true">
                {summary?.has_pending && !isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-bronze" />
                )}
                {summary?.has_busy && !isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-oxblood/70" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-espresso/55">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-bronze" /> pending
        </span>
        <span className="mx-1.5">·</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-oxblood/70" /> busy
        </span>
        <span className="mx-1.5">·</span>
        <span>struck-through days are past or closed</span>
      </p>
    </div>
  );
}
