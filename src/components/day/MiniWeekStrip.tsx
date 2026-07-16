"use client";

import { WEEKDAY_LETTERS, dateKey, isSameDay, startOfWeek, addDays } from "@/lib/date-utils";

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
        const key = dateKey(date);
        const hidden = hiddenDayKeys?.has(key) ?? false;
        return (
          <button
            key={date.toISOString()}
            onClick={() => onSelectDate(date)}
            className="flex flex-col items-center gap-1 py-1"
          >
            <span className="text-[12px] font-medium text-black/45 dark:text-white/45">
              {WEEKDAY_LETTERS[i]}
            </span>
            <span
              data-cal-daynum={key}
              style={hidden ? { opacity: 0 } : undefined}
              className={
                isToday
                  ? "flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-[16px] font-semibold text-white"
                  : isSelected
                    ? "flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-[16px] font-medium text-black dark:bg-white/15 dark:text-white"
                    : "flex h-7 w-7 items-center justify-center text-[16px] text-black dark:text-white"
              }
            >
              {date.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
