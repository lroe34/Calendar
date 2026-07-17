"use client";

import type { CSSProperties } from "react";
import type { CalendarEvent, CalendarSource } from "@/lib/types";
import type { MonthDay } from "@/lib/date-utils";
import { computeWeekSlots, getDayCellBars } from "@/lib/month-layout";
import { CALENDAR_COLORS } from "@/lib/colors";
import { dateKey, isSameDay } from "@/lib/date-utils";
import { MonthDayCell, type RenderedBar } from "./MonthDayCell";
import { TRANSITION_MS, TRANSITION_MS_AFTER_EXIT, TRANSITION_EASE } from "@/lib/transition-constants";

export type WeekTransitionPhase = "before" | "selected" | "after";

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

  // Off-screen resting state for each phase. "before" and "selected" rows
  // both slide up and fade (numbers are represented by flying clones while
  // selected); "after" rows just slide off the bottom, opaque the whole way.
  const offTransform =
    transitionPhase === "after" ? "translateY(100vh)" : "translateY(-100vh)";
  const offOpacity = transitionPhase === "after" ? 1 : 0;

  const isOff = transitionMode === "exit" ? transitionArmed : !transitionArmed;
  // "After" rows only have to clear the viewport, not travel the full
  // 100vh, so the default duration reads as an near-instant flick when
  // they're leaving. Give that specific leg more time.
  const durationMs =
    transitionMode === "exit" && transitionPhase === "after" ? TRANSITION_MS_AFTER_EXIT : TRANSITION_MS;
  const rowStyle: CSSProperties | undefined = transitionPhase
    ? {
        transform: isOff ? offTransform : "translateY(0)",
        opacity: isOff ? offOpacity : 1,
        transition: `transform ${durationMs}ms ${TRANSITION_EASE}, opacity ${durationMs}ms ${TRANSITION_EASE}`,
      }
    : undefined;

  return (
    <div
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
