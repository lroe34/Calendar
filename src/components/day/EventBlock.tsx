import type { CalendarEvent } from "@/lib/types";
import { CALENDAR_COLORS } from "@/lib/colors";
import {
  DETAIL_DISCLOSURE_THRESHOLD_PX,
  MIN_EVENT_HEIGHT_PX,
  minutesToPx,
} from "@/lib/day-grid";
import { formatEventTimeRange, minutesSinceMidnight } from "@/lib/date-utils";
import { ClockIcon, PinIcon, RepeatIcon } from "@/components/shared/Icons";

interface EventBlockProps {
  event: CalendarEvent;
  colorName: keyof typeof CALENDAR_COLORS;
  columnIndex: number;
  columnCount: number;
  /** "tint" (default) is the normal Day-view look; "solid" is the inverted
   * saturated-fill/white-text style used by the detail sheet's mini preview. */
  variant?: "tint" | "solid";
  onClick?: () => void;
}

export function EventBlock({
  event,
  colorName,
  columnIndex,
  columnCount,
  variant = "tint",
  onClick,
}: EventBlockProps) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const top = minutesToPx(minutesSinceMidnight(start));
  const height = Math.max(
    MIN_EVENT_HEIGHT_PX,
    minutesToPx(minutesSinceMidnight(end) - minutesSinceMidnight(start)),
  );
  const color = CALENDAR_COLORS[colorName];
  const showDetails = height >= DETAIL_DISCLOSURE_THRESHOLD_PX;
  const gapPct = 1.5;
  const widthPct = 100 / columnCount - gapPct;
  const leftPct = columnIndex * (100 / columnCount) + gapPct / 2;
  const isSolid = variant === "solid";

  return (
    <button
      onClick={onClick}
      className="absolute overflow-hidden rounded-[7px] text-left"
      style={{
        top,
        height,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: isSolid ? color.accent : color.tint,
      }}
    >
      {!isSolid && (
        <div
          className="absolute left-1 top-1 bottom-1 w-[3px] rounded-full"
          style={{ backgroundColor: color.accent }}
        />
      )}
      <div
        className="flex h-full flex-col gap-0.5 px-2 py-[3px]"
        style={{ color: isSolid ? "#fff" : color.text }}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="truncate text-[12.5px] font-semibold leading-tight">{event.title}</span>
          {event.recurrence && <RepeatIcon className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />}
        </div>
        {showDetails && (
          <>
            {event.location && (
              <div className="flex items-center gap-1 text-[11.5px] opacity-85">
                <PinIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{event.location.name}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-[11.5px] opacity-85">
              <ClockIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{formatEventTimeRange(start, end)}</span>
            </div>
          </>
        )}
      </div>
    </button>
  );
}
