"use client";

import type { CalendarEvent } from "@/lib/types";
import { dateKey } from "@/lib/date-utils";

export interface RenderedBar {
  event: CalendarEvent;
  color: string;
  tint: string;
  textColor: string;
  continuesFromPrev: boolean;
  continuesToNext: boolean;
}

interface MonthDayCellProps {
  date: Date;
  blank: boolean;
  isToday: boolean;
  bars: RenderedBar[];
  overflowCount: number;
  onSelect: (date: Date) => void;
  /** True while this date's number is being represented by a flying clone elsewhere. */
  numberHidden?: boolean;
  eventViewMode: "stacked" | "compact" | "details";
}

export function MonthDayCell({
  date,
  blank,
  isToday,
  bars,
  overflowCount,
  onSelect,
  numberHidden,
  eventViewMode,
}: MonthDayCellProps) {
  if (blank) return <div />;

  return (
    <button
      onClick={() => onSelect(date)}
      className="flex min-w-0 flex-col items-stretch pt-1.5 text-left"
    >
      <div className="flex justify-center">
        <span
          data-cal-daynum={dateKey(date)}
          style={numberHidden ? { opacity: 0 } : undefined}
          className={
            isToday
              ? "flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-[17px] font-semibold text-white"
              : "flex h-9 w-9 items-center justify-center text-[17px] text-black dark:text-white"
          }
        >
          {date.getDate()}
        </span>
      </div>

      <div className={`mt-1 px-[4px] ${eventViewMode === "details" ? "flex flex-col gap-1" : eventViewMode === "stacked" ? "flex flex-col gap-[3px]" : ""}`}>
        {eventViewMode === "compact" && bars.length > 0 ? (
          <div className="flex h-[7px] overflow-hidden rounded-full" aria-label={`${bars.length} events`}>
            {bars.map(({ event, color }) => (
              <span key={event.id} className="min-w-[3px] flex-1" style={{ backgroundColor: color }} />
            ))}
          </div>
        ) : bars.map(({ event, color, tint, textColor, continuesFromPrev, continuesToNext }) => (
          <div
            key={event.id}
            className={eventViewMode === "details" ? "h-6 truncate px-1.5 text-[11px] font-semibold leading-6" : "h-[7px]"}
            style={{
              backgroundColor: eventViewMode === "details" ? tint : color,
              color: eventViewMode === "details" ? textColor : undefined,
              marginLeft: continuesFromPrev ? "-4px" : 0,
              marginRight: continuesToNext ? "-4px" : 0,
              borderTopLeftRadius: continuesFromPrev ? 0 : eventViewMode === "details" ? 6 : 999,
              borderBottomLeftRadius: continuesFromPrev ? 0 : eventViewMode === "details" ? 6 : 999,
              borderTopRightRadius: continuesToNext ? 0 : eventViewMode === "details" ? 6 : 999,
              borderBottomRightRadius: continuesToNext ? 0 : eventViewMode === "details" ? 6 : 999,
            }}
          >
            {eventViewMode === "details" ? event.title : null}
          </div>
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
