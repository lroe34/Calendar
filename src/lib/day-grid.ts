export const HOUR_HEIGHT_PX = 64;
export const PX_PER_MINUTE = HOUR_HEIGHT_PX / 60;
export const MIN_EVENT_HEIGHT_PX = 22;
/** Inset each timed event from its start/end so back-to-back blocks leave
 *  a gap for hour lines (and each other) to stay visible. */
export const EVENT_EDGE_GAP_PX = 2;
export const DETAIL_DISCLOSURE_THRESHOLD_PX = 64;

export function minutesToPx(minutes: number): number {
  return minutes * PX_PER_MINUTE;
}
