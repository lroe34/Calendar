"use client";

import { WEEKDAY_LETTERS, WEEKDAY_NAMES, dateKey, isSameDay, startOfWeek, addDays } from "@/lib/date-utils";
import { TRANSITION_MS, TRANSITION_EASE } from "@/lib/transition-constants";

interface MiniWeekStripProps {
  selectedDate: Date;
  today: Date;
  onSelectDate: (date: Date) => void;
  /** Date keys whose number should stay invisible (a flying clone is standing in for it). */
  hiddenDayKeys?: Set<string>;
  /** Multi-day views use these dates as column headings, not navigation controls. */
  interactive?: boolean;
  /** Use compact, horizontal column labels in multi-day layouts. */
  desktopWeek?: boolean;
  /** Number of visible columns in the responsive day range. */
  visibleDayCount?: 1 | 2 | 3 | 7;
}

export function MiniWeekStrip({
  selectedDate,
  today,
  onSelectDate,
  hiddenDayKeys,
  interactive = true,
  desktopWeek = false,
  visibleDayCount = 7,
}: MiniWeekStripProps) {
  const rangeStart = visibleDayCount === 7 ? startOfWeek(selectedDate) : selectedDate;
  const days = Array.from({ length: visibleDayCount }, (_, i) => addDays(rangeStart, i));

  return (
    <div
      data-cal-ministrip
      className="relative grid px-2 pb-2"
      style={{ gridTemplateColumns: `repeat(${visibleDayCount}, minmax(0, 1fr))` }}
    >
      {days.map((date) => {
        const isToday = isSameDay(date, today);
        const isSelected = isSameDay(date, selectedDate);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const key = dateKey(date);
        const hidden = hiddenDayKeys?.has(key) ?? false;
        // Desktop week headings label columns rather than selecting a date.
        // The compact mobile day view keeps its selected-date circle.
        const showDateHighlight = isSelected && !desktopWeek;
        return (
          <button
            key={date.toISOString()}
            type="button"
            disabled={!interactive}
            onClick={() => onSelectDate(date)}
            className={`flex items-center justify-center py-1 disabled:cursor-default ${desktopWeek ? "flex-row gap-1" : "flex-col gap-1"}`}
          >
            <span
              className={
                `${desktopWeek && visibleDayCount === 7 ? "text-[17px]" : "text-[12px]"} font-medium ${
                  isWeekend ? "text-black/45 dark:text-white/45" : "text-black dark:text-white"
                }`
              }
            >
              {desktopWeek ? WEEKDAY_NAMES[dayOfWeek].slice(0, 3) : WEEKDAY_LETTERS[dayOfWeek]}
            </span>
            <span
              data-cal-daynum={key}
              style={hidden ? { opacity: 0 } : undefined}
              className="relative flex h-9 w-9 items-center justify-center"
            >
              {/* Always mounted (never conditionally rendered) so toggling
                  `isSelected` transitions opacity/scale instead of just
                  popping the highlight in and out. */}
              <span
                aria-hidden
                className={`absolute inset-0 rounded-full ${isToday ? "bg-red-500" : "bg-black dark:bg-white"}`}
                style={{
                  opacity: showDateHighlight ? 1 : 0,
                  transform: showDateHighlight ? "scale(1)" : "scale(0.8)",
                  transition: `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}, transform ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
                }}
              />
              <span
                className={`relative text-[17px] ${
                  showDateHighlight
                    ? `font-bold ${isToday ? "text-white" : "text-white dark:text-black"}`
                    : isToday
                      ? "text-red-500"
                      : "text-black dark:text-white"
                }`}
              >
                {date.getDate()}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
