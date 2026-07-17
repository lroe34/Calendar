import type { CalendarEvent } from "./types";
import { addDays, startOfDay } from "./date-utils";

export interface MonthEventSlot {
  event: CalendarEvent;
  slot: number;
  /** 0-6 index of the day within the week this event starts occupying (clipped). */
  dayStartIndex: number;
  /** 0-6 index of the day within the week this event stops occupying (clipped). */
  dayEndIndex: number;
}

/**
 * Assigns a stable slot (row) index to each event visible within a single
 * week, so multi-day/all-day events keep the same vertical slot across every
 * day they span (making the bar read as one continuous piece), while
 * same-day timed events fill in the remaining slots. Longer-spanning events
 * are placed first so they tend to claim the top slots, matching typical
 * month-view calendar layouts.
 */
export function computeWeekSlots(
  weekDays: Date[],
  weekEvents: CalendarEvent[],
): MonthEventSlot[] {
  const weekStart = startOfDay(weekDays[0]);
  const weekEndExclusive = addDays(weekStart, 7);

  const candidates = weekEvents
    .map((event) => {
      const start = startOfDay(new Date(event.start));
      const rawEnd = new Date(event.end);
      // Treat all-day end dates as exclusive-ish: an all-day event on a
      // single day has start === end, so give it a 1-day-inclusive range.
      const end = event.isAllDay
        ? startOfDay(rawEnd)
        : startOfDay(rawEnd);

      if (end.getTime() < weekStart.getTime() || start.getTime() >= weekEndExclusive.getTime()) {
        return null;
      }

      const dayStartIndex = Math.max(
        0,
        Math.round((start.getTime() - weekStart.getTime()) / 86_400_000),
      );
      const dayEndIndex = Math.min(
        6,
        Math.round((end.getTime() - weekStart.getTime()) / 86_400_000),
      );

      return { event, dayStartIndex, dayEndIndex, startMs: new Date(event.start).getTime() };
    })
    .filter(
      (v): v is { event: CalendarEvent; dayStartIndex: number; dayEndIndex: number; startMs: number } =>
        v !== null,
    );

  candidates.sort((a, b) => {
    const spanA = a.dayEndIndex - a.dayStartIndex;
    const spanB = b.dayEndIndex - b.dayStartIndex;
    if (spanB !== spanA) return spanB - spanA;
    if (a.dayStartIndex !== b.dayStartIndex) return a.dayStartIndex - b.dayStartIndex;
    // Same-day events tie on span/start-day — break by actual time of day so
    // the bar stacking order matches the chronological order Day view shows.
    return a.startMs - b.startMs;
  });

  const slotEnd: number[] = [];
  const results: MonthEventSlot[] = [];

  for (const c of candidates) {
    let slot = slotEnd.findIndex((end) => end < c.dayStartIndex);
    if (slot === -1) {
      slot = slotEnd.length;
      slotEnd.push(c.dayEndIndex);
    } else {
      slotEnd[slot] = c.dayEndIndex;
    }
    results.push({ event: c.event, slot, dayStartIndex: c.dayStartIndex, dayEndIndex: c.dayEndIndex });
  }

  return results;
}

export interface DayCellBars {
  bars: MonthEventSlot[];
  overflowCount: number;
}

const MAX_VISIBLE_BARS = 2;

export function getDayCellBars(slots: MonthEventSlot[], dayIndex: number): DayCellBars {
  const touching = slots
    .filter((s) => dayIndex >= s.dayStartIndex && dayIndex <= s.dayEndIndex)
    .sort((a, b) => a.slot - b.slot);

  return {
    bars: touching.slice(0, MAX_VISIBLE_BARS),
    overflowCount: Math.max(0, touching.length - MAX_VISIBLE_BARS),
  };
}
