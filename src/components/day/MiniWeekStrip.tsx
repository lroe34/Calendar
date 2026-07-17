"use client";

import { WEEKDAY_LETTERS, dateKey, isSameDay, startOfWeek, addDays } from "@/lib/date-utils";
import { TRANSITION_MS, TRANSITION_EASE } from "@/lib/transition-constants";

interface MiniWeekStripProps {
  selectedDate: Date;
  today: Date;
  onSelectDate: (date: Date) => void;
  /** Date keys whose number should stay invisible (a flying clone is standing in for it). */
  hiddenDayKeys?: Set<string>;
}

export function MiniWeekStrip({ selectedDate, today, onSelectDate, hiddenDayKeys }: MiniWeekStripProps) {
  const weekStart = startOfWeek(selectedDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div data-cal-ministrip className="grid grid-cols-7 px-2 pb-2">
      {days.map((date, i) => {
        const isToday = isSameDay(date, today);
        const isSelected = isSameDay(date, selectedDate);
        const isWeekend = i === 0 || i === 6;
        const key = dateKey(date);
        const hidden = hiddenDayKeys?.has(key) ?? false;
        return (
          <button
            key={date.toISOString()}
            onClick={() => onSelectDate(date)}
            className="flex flex-col items-center gap-1 py-1"
          >
            <span
              className={
                isWeekend
                  ? "text-[12px] font-medium text-black/45 dark:text-white/45"
                  : "text-[12px] font-medium text-black dark:text-white"
              }
            >
              {WEEKDAY_LETTERS[i]}
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
                  opacity: isSelected ? 1 : 0,
                  transform: isSelected ? "scale(1)" : "scale(0.8)",
                  transition: `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}, transform ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
                }}
              />
              <span
                className={`relative text-[17px] ${
                  isSelected
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
