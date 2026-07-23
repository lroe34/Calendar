import type { CalendarEvent, CalendarColorName } from "@/lib/types";
import { HOUR_HEIGHT_PX, timedEventDaySegment } from "@/lib/day-grid";
import { formatHour } from "@/lib/date-utils";
import { EventBlock } from "@/components/day/EventBlock";
import { SOLO_LAYOUT } from "@/lib/event-layout";

interface MiniDayPreviewProps {
  event: CalendarEvent;
  colorName: CalendarColorName;
}

const GUTTER_WIDTH_PX = 44;

export function MiniDayPreview({ event, colorName }: MiniDayPreviewProps) {
  const start = new Date(event.start);
  // Preview the event on its start day: a multi-day event is clipped to that
  // day's bounds so the window doesn't collapse (its end minute lands on a
  // later day). Falls back to a single day's own start/end.
  const segment =
    timedEventDaySegment(event.start, event.end, start) ??
    ({ startMin: 0, endMin: 0, continuesBefore: false, continuesAfter: false } as const);
  const startHour = Math.max(0, Math.floor(segment.startMin / 60) - 1);
  const endHour = Math.min(24, Math.ceil(segment.endMin / 60) + 1);
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
          <EventBlock
            event={event}
            colorName={colorName}
            segment={segment}
            leftPct={SOLO_LAYOUT.leftPct}
            widthPct={SOLO_LAYOUT.widthPct}
            variant="solid"
          />
        </div>
      </div>
    </div>
  );
}
