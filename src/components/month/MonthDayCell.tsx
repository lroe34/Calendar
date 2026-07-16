"use client";

import type { CalendarEvent } from "@/lib/types";

export interface RenderedBar {
  event: CalendarEvent;
  color: string;
  continuesFromPrev: boolean;
  continuesToNext: boolean;
}

interface MonthDayCellProps {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  bars: RenderedBar[];
  overflowCount: number;
  onSelect: (date: Date) => void;
}

export function MonthDayCell({
  date,
  inCurrentMonth,
  isToday,
  bars,
  overflowCount,
  onSelect,
}: MonthDayCellProps) {
  return (
    <button
      onClick={() => onSelect(date)}
      className="flex min-w-0 flex-col items-stretch pt-1.5 text-left"
    >
      <div className="flex justify-center">
        <span
          className={
            isToday
              ? "flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-[17px] font-semibold text-white"
              : `flex h-7 w-7 items-center justify-center text-[17px] ${
                  inCurrentMonth ? "text-black dark:text-white" : "text-black/30 dark:text-white/25"
                }`
          }
        >
          {date.getDate()}
        </span>
      </div>

      <div className="mt-1 flex flex-col gap-[3px] px-[3px]">
        {bars.map(({ event, color, continuesFromPrev, continuesToNext }) => (
          <div
            key={event.id}
            className="h-[3.5px]"
            style={{
              backgroundColor: color,
              marginLeft: continuesFromPrev ? "-3px" : 0,
              marginRight: continuesToNext ? "-3px" : 0,
              borderTopLeftRadius: continuesFromPrev ? 0 : 999,
              borderBottomLeftRadius: continuesFromPrev ? 0 : 999,
              borderTopRightRadius: continuesToNext ? 0 : 999,
              borderBottomRightRadius: continuesToNext ? 0 : 999,
            }}
          />
        ))}
        {overflowCount > 0 && (
          <span className="text-center text-[11px] leading-tight text-black/40 dark:text-white/40">
            +{overflowCount}
          </span>
        )}
      </div>
    </button>
  );
}
