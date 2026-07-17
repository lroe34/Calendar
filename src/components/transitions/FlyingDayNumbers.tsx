"use client";

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
  /** The specific date the user tapped/back-navigated to; only it gets the "selected" pill. */
  activeDate: Date;
  /** Always known synchronously (measured at the moment the transition starts). */
  fromRects: (FlyingRect | null)[];
  /** null until the entering view has mounted and its rects have been measured. */
  toRects: (FlyingRect | null)[] | null;
  /** false = render at `fromRects` (pre-animation); true = render at `toRects` (post-animation). */
  armed: boolean;
  /** Whether the destination context is the day view (shows a selected pill) vs month (no pill). */
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
  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      {days.map((date, i) => {
        const from = fromRects[i];
        if (!from) return null;
        // Measured and confirmed there's genuinely no destination cell (a
        // month boundary blank day) — let the plain content fade handle it.
        if (toRects && toRects[i] === null) return null;

        const to = toRects ? toRects[i] : null;
        const target = to ?? from;
        const shown = armed ? target : from;
        const isToday = isSameDay(date, today);
        const isActive = isSameDay(date, activeDate);
        const pillVisible = isActive && armed === pillAppears;

        return (
          <div
            key={dateKey(date)}
            className="absolute"
            style={{
              left: shown.left,
              top: shown.top,
              width: shown.width,
              height: shown.height,
              transition: `left ${TRANSITION_MS}ms ${TRANSITION_EASE}, top ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
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
              className={`relative flex h-full w-full items-center justify-center text-[16px] ${
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
