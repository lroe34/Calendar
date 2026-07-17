"use client";

import { useLayoutEffect, useRef } from "react";
import { dateKey, isSameDay } from "@/lib/date-utils";
import { TRANSITION_MS, TRANSITION_EASE } from "@/lib/transition-constants";

export interface FlyingRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface FlyingDayNumbersProps {
  /** The 7 days (Sun..Sat) of the week being carried across views. */
  days: Date[];
  today: Date;
  /** Day-view selected date (tapped in month, or current selection when going back). */
  activeDate: Date;
  /** Always known synchronously (measured at the moment the transition starts). */
  fromRects: (FlyingRect | null)[];
  /** null until the entering view has mounted and its rects have been measured. */
  toRects: (FlyingRect | null)[] | null;
  /** false = render at `fromRects` (pre-animation); true = start WAAPI fly to `toRects`. */
  armed: boolean;
  /**
   * Destination context. Day view's "selected" pill is `activeDate`; month
   * view's standing highlight is always today. The pill morphs between those
   * two (same grow/shrink as MiniWeekStrip date changes) rather than only
   * appearing/disappearing on `activeDate`.
   */
  pillAppears: boolean;
}

export function FlyingDayNumbers({
  days,
  today,
  activeDate,
  fromRects,
  toRects,
  armed,
  pillAppears,
}: FlyingDayNumbersProps) {
  // toDay: month's today-highlight → day's selected pill.
  // toMonth: day's selected pill → month's today-highlight.
  // When those are the same date the pill simply stays put.
  const pillFromDate = pillAppears ? today : activeDate;
  const pillToDate = pillAppears ? activeDate : today;

  // Each clone is anchored at its fromRect and moved via WAAPI translate so
  // it runs on the same animation engine as DayView's content slide —
  // identical driver, identical easing, identical start frame.
  const cloneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animRefs = useRef<(Animation | null)[]>([]);
  const hasArmedRef = useRef(false);

  useLayoutEffect(() => {
    if (!armed || !toRects || hasArmedRef.current) return;
    hasArmedRef.current = true;

    days.forEach((_, i) => {
      const from = fromRects[i];
      const to = toRects[i];
      // Null dest means no destination cell — element isn't rendered.
      if (!from || to === null) return;
      const el = cloneRefs.current[i];
      if (!el) return;

      const dx = (to?.left ?? from.left) - from.left;
      const dy = (to?.top ?? from.top) - from.top;

      const anim = el.animate(
        [
          { transform: "translate(0px, 0px)" },
          { transform: `translate(${dx}px, ${dy}px)` },
        ],
        { duration: TRANSITION_MS, easing: TRANSITION_EASE, fill: "forwards" },
      );
      animRefs.current[i] = anim;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, toRects]);

  useLayoutEffect(() => {
    return () => {
      animRefs.current.forEach((a) => a?.cancel());
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      {days.map((date, i) => {
        const from = fromRects[i];
        if (!from) return null;
        // Measured and confirmed there's genuinely no destination cell (a
        // month boundary blank day) — let the plain content fade handle it.
        if (toRects && toRects[i] === null) return null;

        const isToday = isSameDay(date, today);
        const pillVisible = isSameDay(date, armed ? pillToDate : pillFromDate);

        return (
          <div
            key={dateKey(date)}
            ref={(el) => {
              cloneRefs.current[i] = el;
            }}
            className="absolute"
            style={{
              left: from.left,
              top: from.top,
              width: from.width,
              height: from.height,
              // No CSS transition — WAAPI handles the fly via translate.
            }}
          >
            <div
              className={`absolute inset-0 rounded-full ${isToday ? "bg-red-500" : "bg-black dark:bg-white"}`}
              style={{
                opacity: pillVisible ? 1 : 0,
                transform: pillVisible ? "scale(1)" : "scale(0.8)",
                transition: `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}, transform ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
              }}
            />
            <span
              className={`relative flex h-full w-full items-center justify-center text-[17px] ${
                pillVisible
                  ? `font-bold ${isToday ? "text-white" : "text-white dark:text-black"}`
                  : isToday
                    ? "text-red-500"
                    : "text-black dark:text-white"
              }`}
            >
              {date.getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
