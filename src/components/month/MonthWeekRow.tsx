"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { CalendarEvent, CalendarSource } from "@/lib/types";
import type { MonthDay } from "@/lib/date-utils";
import { computeWeekSlots, getDayCellBars } from "@/lib/month-layout";
import { CALENDAR_COLORS } from "@/lib/colors";
import { dateKey, isSameDay } from "@/lib/date-utils";
import { MonthDayCell, type RenderedBar } from "./MonthDayCell";
import { TRANSITION_MS, TRANSITION_MS_AFTER_EXIT, TRANSITION_EASE } from "@/lib/transition-constants";

export type WeekTransitionPhase = "before" | "selected" | "after";

/** Off-screen resting transform for a row/header at the given transition
 *  phase. "after" rows travel fully off the bottom of the viewport (they're
 *  not visually related to anything staying behind). "before" and
 *  "selected" rows/headers only travel as far as the flying day-numbers do
 *  — the same distance DayView's content slides by — so the whole group
 *  above the fold moves and fades together rather than the selected row's
 *  own events flying off the top independently of its (now-hidden) day
 *  number. Falls back to the old full-viewport travel if the distance
 *  isn't measured yet. */
export function weekOffTransform(
  phase: WeekTransitionPhase | null | undefined,
  slideDistancePx: number | null | undefined,
): string {
  if (phase === "after") return "translateY(100vh)";
  if ((phase === "before" || phase === "selected") && slideDistancePx != null) {
    return `translateY(-${slideDistancePx}px)`;
  }
  return "translateY(-100vh)";
}

interface MonthWeekRowProps {
  weekLabel: number;
  days: MonthDay[];
  events: CalendarEvent[];
  calendarsById: Map<string, CalendarSource>;
  today: Date;
  onSelectDate: (date: Date) => void;
  /** Non-null while a month<->day transition is animating this row. */
  transitionPhase?: WeekTransitionPhase | null;
  /** "exit": row is leaving (was resting, animates off). "enter": row is arriving (was off, animates to resting). */
  transitionMode?: "exit" | "enter" | null;
  /** Flips true one frame after mount so the off/resting swap is observed by the browser as a transition. */
  transitionArmed?: boolean;
  /** Vertical travel of the flying day-numbers; "before" rows slide by this same distance instead of the full viewport. */
  slideDistancePx?: number | null;
}

export function MonthWeekRow({
  weekLabel,
  days,
  events,
  calendarsById,
  today,
  onSelectDate,
  transitionPhase = null,
  transitionMode = null,
  transitionArmed = false,
  slideDistancePx = null,
}: MonthWeekRowProps) {
  const weekDays = days.map((d) => d.date);
  const slots = computeWeekSlots(weekDays, events);

  // Blank (adjacent-month) cells never show bars here — that date's events
  // render in its own month's section instead.
  const perDay = weekDays.map((_, i) => (days[i].blank ? { bars: [], overflowCount: 0 } : getDayCellBars(slots, i)));

  const renderedPerDay: { bars: RenderedBar[]; overflowCount: number }[] = perDay.map(
    (cell, i) => ({
      overflowCount: cell.overflowCount,
      bars: cell.bars.map((slot, rank) => {
        const calendar = calendarsById.get(slot.event.calendarId);
        const color = calendar ? CALENDAR_COLORS[calendar.color].accent : "#999";
        const prevBarAtRank = i > 0 ? perDay[i - 1].bars[rank] : undefined;
        const nextBarAtRank = i < 6 ? perDay[i + 1].bars[rank] : undefined;
        return {
          event: slot.event,
          color,
          continuesFromPrev: prevBarAtRank?.event.id === slot.event.id,
          continuesToNext: nextBarAtRank?.event.id === slot.event.id,
        };
      }),
    }),
  );

  // Off-screen resting state for each phase. "before"/"selected" rows slide
  // up; "after" rows slide down. Exit still fades via CSS; enter stays
  // opaque and is driven by WAAPI (same paint-race fix as DayView) so a
  // fresh MonthView mount can't skip the slide and teleport into place.
  // Selected-week day numbers stay hidden on the row (`numberHidden`) and
  // ride the flying clones instead — the rest of the row travels with this
  // transform.
  const offTransform = weekOffTransform(transitionPhase, slideDistancePx);
  const offOpacity = transitionMode === "exit" ? 0 : 1;

  const isOff = transitionMode === "exit" ? transitionArmed : !transitionArmed;
  const durationMs =
    transitionMode === "exit" && transitionPhase === "after" ? TRANSITION_MS_AFTER_EXIT : TRANSITION_MS;

  const rowRef = useRef<HTMLDivElement>(null);
  const enterAnimRef = useRef<Animation | null>(null);
  const hasStartedEnterAnimRef = useRef(false);
  const [enterAnimStarted, setEnterAnimStarted] = useState(false);

  useLayoutEffect(() => {
    if (transitionMode !== "enter" || !transitionPhase || !transitionArmed) return;
    if (hasStartedEnterAnimRef.current) return;
    const el = rowRef.current;
    if (!el) return;
    hasStartedEnterAnimRef.current = true;

    const anim = el.animate(
      [
        { transform: offTransform, opacity: 1 },
        { transform: "translateY(0px)", opacity: 1 },
      ],
      { duration: durationMs, easing: TRANSITION_EASE },
    );
    enterAnimRef.current = anim;
    setEnterAnimStarted(true);
    anim.finished.then(() => anim.cancel()).catch(() => {});
  }, [transitionMode, transitionPhase, transitionArmed, offTransform, durationMs]);

  useEffect(() => {
    return () => {
      enterAnimRef.current?.cancel();
      enterAnimRef.current = null;
    };
  }, []);

  const isEnterAwaitingAnimation = transitionMode === "enter" && !enterAnimStarted;

  let rowStyle: CSSProperties | undefined;
  if (transitionPhase) {
    if (transitionMode === "enter") {
      // Hold the off transform with transitions suppressed until WAAPI takes
      // over. Clearing transform once the anim starts matches DayView: after
      // WAAPI cancel(), the element must not snap back to the off position.
      rowStyle = {
        transform: isEnterAwaitingAnimation ? offTransform : undefined,
        opacity: 1,
        transition: "none",
        zIndex: transitionPhase === "after" ? 30 : undefined,
      };
    } else {
      rowStyle = {
        transform: isOff ? offTransform : "translateY(0)",
        opacity: isOff ? offOpacity : 1,
        zIndex: transitionPhase === "after" ? 30 : undefined,
        transition: `transform ${durationMs}ms ${TRANSITION_EASE}, opacity ${durationMs}ms ${TRANSITION_EASE}`,
      };
    }
  }

  return (
    <div
      ref={rowRef}
      data-cal-week={dateKey(weekDays[0])}
      className="relative grid grid-cols-7 border-b border-black/[.06] pb-4 dark:border-white/[.08]"
      style={rowStyle}
    >
      {/* Overlaid on the divider line above this row (rather than a
          dedicated left gutter) so the day grid — and the event bars in
          it — can run all the way to the screen edge. The row's own pb-4
          keeps its last bar clear of the line so this doesn't get
          overlapped by Sunday's bottommost bar in a tall week. */}
      <span className="pointer-events-none absolute left-1 top-0 -translate-y-1/2 text-[11px] text-black/35 dark:text-white/35">
        {weekLabel}
      </span>
      {days.map((day, i) => (
        <MonthDayCell
          key={day.date.toISOString()}
          date={day.date}
          blank={day.blank}
          isToday={isSameDay(day.date, today)}
          bars={renderedPerDay[i].bars}
          overflowCount={renderedPerDay[i].overflowCount}
          onSelect={onSelectDate}
          numberHidden={transitionPhase === "selected"}
        />
      ))}
    </div>
  );
}
