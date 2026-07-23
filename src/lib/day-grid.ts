import { startOfDay } from "./date-utils";

export const HOUR_HEIGHT_PX = 64;
export const PX_PER_MINUTE = HOUR_HEIGHT_PX / 60;
/** Pinch-to-zoom bounds for the day-view hour grid. The rendered hour height
 *  is a runtime value (see DayScaleContext) that the pinch gesture drives
 *  between these; HOUR_HEIGHT_PX is its default/at-rest value. */
export const MIN_HOUR_HEIGHT_PX = 32;
export const MAX_HOUR_HEIGHT_PX = 200;
export const MIN_EVENT_HEIGHT_PX = 22;
/** Inset each timed event from its start/end so back-to-back blocks leave
 *  a gap for hour lines (and each other) to stay visible. */
export const EVENT_EDGE_GAP_PX = 2;
export const DETAIL_DISCLOSURE_THRESHOLD_PX = 64;

export const MINUTES_IN_DAY = 24 * 60;

/** Snap granularity for on-grid move/resize (matches iOS Calendar's 15-min grid). */
export const SNAP_MINUTES = 15;
/** Shortest duration a block can be resized to. */
export const MIN_EVENT_DURATION_MIN = 15;
/** Hold time before a press on an event becomes an on-grid edit rather than a tap. */
export const LONG_PRESS_MS = 420;
/** Movement past this (px) during the hold cancels the long-press — it's a scroll/swipe. */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

export function minutesToPx(minutes: number): number {
  return minutes * PX_PER_MINUTE;
}

export function pxToMinutes(px: number): number {
  return px / PX_PER_MINUTE;
}

export function snapMinutes(minutes: number, increment: number = SNAP_MINUTES): number {
  return Math.round(minutes / increment) * increment;
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** The slice of a timed event that falls on a single calendar day. Multi-day
 *  events (ones whose start/end straddle midnight, or span several days)
 *  produce one segment per day they touch, each clipped to that day's
 *  midnight bounds. */
export interface EventDaySegment {
  /** Minutes since midnight where the event's portion on this day begins
   *  (0 when the event started on an earlier day). */
  startMin: number;
  /** Minutes since midnight where it ends on this day (MINUTES_IN_DAY when it
   *  continues into a later day). */
  endMin: number;
  /** The event began on an earlier calendar day. */
  continuesBefore: boolean;
  /** The event ends on a later calendar day. */
  continuesAfter: boolean;
}

/**
 * The portion of a timed event visible on `day`, clipped to that day's
 * midnight bounds — or null if the event doesn't overlap the day at all.
 * `startIso`/`endIso` are the event's raw start/end; the event's interval is
 * treated as half-open `[start, end)`, so an event ending exactly at midnight
 * belongs to the day it started, not the following one.
 */
export function timedEventDaySegment(
  startIso: string,
  endIso: string,
  day: Date,
): EventDaySegment | null {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + MINUTES_IN_DAY * 60_000;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();

  if (start >= dayEnd || end <= dayStart) return null;

  return {
    startMin: start <= dayStart ? 0 : Math.round((start - dayStart) / 60_000),
    endMin: end >= dayEnd ? MINUTES_IN_DAY : Math.round((end - dayStart) / 60_000),
    continuesBefore: start < dayStart,
    continuesAfter: end > dayEnd,
  };
}

/** Local-naive `YYYY-MM-DDTHH:mm:00` (same shape the mock data uses), built
 *  from `base`'s calendar day and a minutes-since-midnight offset. */
export function minutesToLocalIso(base: Date, minutes: number): string {
  const clamped = clamp(Math.round(minutes), 0, MINUTES_IN_DAY);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}` +
    `T${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}:00`
  );
}
