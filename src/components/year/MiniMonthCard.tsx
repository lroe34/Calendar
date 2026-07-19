"use client";

import { MONTH_ABBR, generateCalendarMonths, isSameDay } from "@/lib/date-utils";

interface MiniMonthCardProps {
  year: number;
  month: number;
  today: Date;
  onSelect: (year: number, month: number) => void;
}

export function MiniMonthCard({ year, month, today, onSelect }: MiniMonthCardProps) {
  const section = generateCalendarMonths(year, month, 0, 0)[0];
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <button
      data-cal-year-month={`${year}-${month}`}
      onClick={() => onSelect(year, month)}
      className="flex min-w-0 flex-col items-stretch text-left"
    >
      <h3
        className={`mb-1.5 text-[19px] font-bold leading-tight ${
          isCurrentMonth ? "text-red-500" : "text-black dark:text-white"
        }`}
      >
        {MONTH_ABBR[month]}
      </h3>
      <div className="grid grid-cols-7 gap-y-[2px]">
        {section.weeks.flatMap((week) =>
          week.days.map((day) => {
            if (day.blank) {
              return <span key={day.date.toISOString()} />;
            }
            const isToday = isSameDay(day.date, today);
            return (
              <span key={day.date.toISOString()} className="flex h-[16px] items-center justify-center">
                <span
                  className={
                    isToday
                      ? "flex h-[15px] w-[15px] items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white"
                      : "text-[10px] text-black dark:text-white"
                  }
                >
                  {day.date.getDate()}
                </span>
              </span>
            );
          }),
        )}
      </div>
    </button>
  );
}
