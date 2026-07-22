"use client";

import { createContext, useContext, useMemo } from "react";
import { HOUR_HEIGHT_PX } from "@/lib/day-grid";

/** The live rendered height of one hour on the Day view's grid, in px.
 *  Owned by DayView (pinch-to-zoom drives it) and read by every piece of the
 *  hour grid so the whole layout — hour lines, event blocks, the now-line —
 *  scales together. Defaults to HOUR_HEIGHT_PX outside a provider. */
export const DayScaleContext = createContext<number>(HOUR_HEIGHT_PX);

export function useHourHeight(): number {
  return useContext(DayScaleContext);
}

/** Hour height plus the px<->minute conversions bound to it — the dynamic
 *  equivalents of day-grid's fixed `minutesToPx`/`pxToMinutes`. */
export function useDayScale() {
  const hourHeight = useContext(DayScaleContext);
  return useMemo(() => {
    const pxPerMinute = hourHeight / 60;
    return {
      hourHeight,
      pxPerMinute,
      minutesToPx: (minutes: number) => minutes * pxPerMinute,
      pxToMinutes: (px: number) => px / pxPerMinute,
    };
  }, [hourHeight]);
}
