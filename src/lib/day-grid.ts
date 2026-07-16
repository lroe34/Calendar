export const HOUR_HEIGHT_PX = 64;
export const PX_PER_MINUTE = HOUR_HEIGHT_PX / 60;
export const MIN_EVENT_HEIGHT_PX = 22;
export const DETAIL_DISCLOSURE_THRESHOLD_PX = 64;

export function minutesToPx(minutes: number): number {
  return minutes * PX_PER_MINUTE;
}
