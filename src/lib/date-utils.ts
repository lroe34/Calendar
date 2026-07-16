export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Sunday that begins the week containing `date`. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

/**
 * Week-of-year label matching the reference screenshots: Sunday-start weeks,
 * with the partial week containing Jan 1 counted as week 1 (i.e. classic
 * `%U`-style week number, shifted up by one for display).
 */
export function getWeekLabel(date: Date): number {
  const year = date.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const jan1SundayOffset = jan1.getDay();
  const dayOfYear = Math.floor(
    (startOfDay(date).getTime() - jan1.getTime()) / 86_400_000,
  );
  return Math.floor((dayOfYear + jan1SundayOffset) / 7) + 1;
}

export interface MonthDay {
  date: Date;
  /** True for the padding days before day 1 / after the last day of the month. */
  blank: boolean;
}

export interface WeekRow {
  weekLabel: number;
  days: MonthDay[];
}

export interface MonthSection {
  year: number;
  month: number;
  weeks: WeekRow[];
}

/**
 * Builds one month's Sunday-start week rows, independent of any adjacent
 * month. Months don't share a row at their boundary: the leading/trailing
 * days that would belong to another month are rendered as blank cells (no
 * number, no bars) rather than grayed-out adjacent-month numbers, matching
 * the reference (June's last row stops at its own last day; July's first
 * row starts fresh at whatever weekday the 1st falls on).
 */
function buildMonthSection(year: number, month: number): MonthSection {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lastOfMonth = new Date(year, month, daysInMonth);

  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const gridEnd = addDays(lastOfMonth, 6 - lastOfMonth.getDay());

  const weeks: WeekRow[] = [];
  let cursor = gridStart;
  while (cursor.getTime() <= gridEnd.getTime()) {
    const days: MonthDay[] = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(cursor, i);
      return { date: d, blank: d.getMonth() !== month || d.getFullYear() !== year };
    });
    weeks.push({ weekLabel: getWeekLabel(cursor), days });
    cursor = addDays(cursor, 7);
  }

  return { year, month, weeks };
}

/** Builds independent month sections spanning `monthsBefore`..`monthsAfter` around (year, month). */
export function generateCalendarMonths(
  year: number,
  month: number,
  monthsBefore: number,
  monthsAfter: number,
): MonthSection[] {
  const sections: MonthSection[] = [];
  for (let offset = -monthsBefore; offset <= monthsAfter; offset++) {
    const d = new Date(year, month + offset, 1);
    sections.push(buildMonthSection(d.getFullYear(), d.getMonth()));
  }
  return sections;
}

export function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "Noon";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function formatDayHeading(date: Date): string {
  return `${WEEKDAY_NAMES[date.getDay()]} – ${
    MONTH_ABBR[date.getMonth()]
  } ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatEventTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const period = h < 12 ? "AM" : "PM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${displayHour}${period}` : `${displayHour}:${String(m).padStart(2, "0")}${period}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

export function formatFullDate(date: Date): string {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatTimeSpaced(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h < 12 ? "AM" : "PM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatEventTimeRangeSpaced(start: Date, end: Date): string {
  return `${formatTimeSpaced(start)} – ${formatTimeSpaced(end)}`;
}

export function formatDatePill(date: Date): string {
  return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** yyyy-mm-dd for native <input type="date"> */
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/** HH:mm for native <input type="time"> */
export function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}
