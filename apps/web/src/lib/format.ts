/** Shared date/time formatting helpers (single source of truth for owner UI). */

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayYYYYMMDD(): string {
  return formatDateYYYYMMDD(new Date());
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayYYYYMMDD();
}

/** "Sep 9, 10:30 AM" — compact slot label for cards. */
export function formatSlot(slot: string): string {
  return new Date(slot).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "10:30 AM" */
export function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "10:30 AM - 11:00 AM" given a start ISO + duration (hyphen for ranges). */
export function formatSlotRange(slotStart: string, durationMinutes?: number): string {
  const start = new Date(slotStart);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  if (!durationMinutes) return fmt(start);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return `${fmt(start)} - ${fmt(end)}`;
}

/** "Tue, Sep 9" for day headers. */
export function formatDayHeader(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Sep 8 - Sep 14, 2026" for week navigation (hyphen for ranges). */
export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(monday)} - ${fmt(sunday)}, ${monday.getFullYear()}`;
}

/** "Sep 9, 2026, 10:30 AM" — full timestamp for meta rows. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
