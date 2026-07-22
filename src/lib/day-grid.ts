export const HOUR_HEIGHT_PX = 64;
export const PX_PER_MINUTE = HOUR_HEIGHT_PX / 60;
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
