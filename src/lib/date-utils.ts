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
  inCurrentMonth: boolean;
}

export interface WeekRow {
  weekLabel: number;
  days: MonthDay[];
  /** Month (0-11) this week is grouped under, keyed off its Thursday. */
  primaryMonth: number;
  primaryYear: number;
}

export interface MonthSection {
  year: number;
  month: number;
  weeks: WeekRow[];
}

/**
 * Builds a continuous, deduplicated list of Sunday-start week rows spanning
 * `monthsBefore`..`monthsAfter` months around (year, month), grouped into
 * month sections. A week is assigned to the month containing its Thursday,
 * matching the boundary behavior observed in the reference screenshot (the
 * Jul 26 - Aug 1 week stays under "July"; "Aug" starts at Aug 2).
 */
export function generateCalendarMonths(
  year: number,
  month: number,
  monthsBefore: number,
  monthsAfter: number,
): MonthSection[] {
  const rangeStart = new Date(year, month - monthsBefore, 1);
  const rangeEndExclusive = new Date(year, month + monthsAfter + 1, 1);

  const firstWeekStart = startOfWeek(rangeStart);

  const sections: MonthSection[] = [];
  let cursor = firstWeekStart;

  while (cursor.getTime() < rangeEndExclusive.getTime()) {
    const days: MonthDay[] = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(cursor, i);
      return { date: d, inCurrentMonth: false };
    });
    const thursday = days[4].date;
    const primaryMonth = thursday.getMonth();
    const primaryYear = thursday.getFullYear();

    for (const day of days) {
      day.inCurrentMonth =
        day.date.getMonth() === primaryMonth &&
        day.date.getFullYear() === primaryYear;
    }

    const week: WeekRow = {
      weekLabel: getWeekLabel(cursor),
      days,
      primaryMonth,
      primaryYear,
    };

    let section = sections[sections.length - 1];
    if (
      !section ||
      section.month !== primaryMonth ||
      section.year !== primaryYear
    ) {
      section = { year: primaryYear, month: primaryMonth, weeks: [] };
      sections.push(section);
    }
    section.weeks.push(week);

    cursor = addDays(cursor, 7);
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

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}
