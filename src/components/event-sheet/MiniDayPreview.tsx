import type { CalendarEvent, CalendarColorName } from "@/lib/types";
import { HOUR_HEIGHT_PX } from "@/lib/day-grid";
import { formatHour, minutesSinceMidnight } from "@/lib/date-utils";
import { EventBlock } from "@/components/day/EventBlock";

interface MiniDayPreviewProps {
  event: CalendarEvent;
  colorName: CalendarColorName;
}

const GUTTER_WIDTH_PX = 44;

export function MiniDayPreview({ event, colorName }: MiniDayPreviewProps) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const startHour = Math.max(0, Math.floor(minutesSinceMidnight(start) / 60) - 1);
  const endHour = Math.min(24, Math.ceil(minutesSinceMidnight(end) / 60) + 1);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const windowTop = startHour * HOUR_HEIGHT_PX;

  return (
    <div className="overflow-hidden rounded-2xl bg-white dark:bg-white/10">
      <div className="relative" style={{ height: (endHour - startHour) * HOUR_HEIGHT_PX }}>
        {hours.map((hour) => (
          <div
            key={hour}
            className="absolute inset-x-0 border-t border-black/[.07] dark:border-white/[.1]"
            style={{ top: hour * HOUR_HEIGHT_PX - windowTop }}
          >
            <span
              className="absolute -translate-y-1/2 text-right text-[11px] text-black/40 dark:text-white/40"
              style={{ left: 4, width: GUTTER_WIDTH_PX - 10 }}
            >
              {formatHour(hour)}
            </span>
          </div>
        ))}

        <div
          className="absolute"
          style={{
            left: GUTTER_WIDTH_PX,
            right: 8,
            top: -windowTop,
            height: 24 * HOUR_HEIGHT_PX,
          }}
        >
          <EventBlock event={event} colorName={colorName} columnIndex={0} columnCount={1} variant="solid" />
        </div>
      </div>
    </div>
  );
}
