"use client";

import type { CalendarEvent, CalendarSource } from "@/lib/types";
import type { MonthDay } from "@/lib/date-utils";
import { computeWeekSlots, getDayCellBars } from "@/lib/month-layout";
import { CALENDAR_COLORS } from "@/lib/colors";
import { isSameDay } from "@/lib/date-utils";
import { MonthDayCell, type RenderedBar } from "./MonthDayCell";

interface MonthWeekRowProps {
  weekLabel: number;
  days: MonthDay[];
  events: CalendarEvent[];
  calendarsById: Map<string, CalendarSource>;
  today: Date;
  onSelectDate: (date: Date) => void;
}

export function MonthWeekRow({
  weekLabel,
  days,
  events,
  calendarsById,
  today,
  onSelectDate,
}: MonthWeekRowProps) {
  const weekDays = days.map((d) => d.date);
  const slots = computeWeekSlots(weekDays, events);

  const perDay = weekDays.map((_, i) => getDayCellBars(slots, i));

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

  return (
    <div className="flex border-b border-black/[.06] dark:border-white/[.08]">
      <div className="w-5 shrink-0 pt-1.5 text-right text-[11px] text-black/35 dark:text-white/35">
        {weekLabel}
      </div>
      <div className="grid grow grid-cols-7">
        {days.map((day, i) => (
          <MonthDayCell
            key={day.date.toISOString()}
            date={day.date}
            inCurrentMonth={day.inCurrentMonth}
            isToday={isSameDay(day.date, today)}
            bars={renderedPerDay[i].bars}
            overflowCount={renderedPerDay[i].overflowCount}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
}
