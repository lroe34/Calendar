import type { CalendarEvent, CalendarSource } from "@/lib/types";
import { HOUR_HEIGHT_PX } from "@/lib/day-grid";
import { formatHour } from "@/lib/date-utils";
import { layoutOverlappingEvents } from "@/lib/event-layout";
import { EventBlock } from "./EventBlock";
import { CurrentTimeLine } from "./CurrentTimeLine";

interface HourGridProps {
  events: CalendarEvent[];
  calendarsById: Map<string, CalendarSource>;
  isToday: boolean;
  onSelectEvent?: (event: CalendarEvent) => void;
}

const GUTTER_WIDTH_PX = 52;

export function HourGrid({ events, calendarsById, isToday, onSelectEvent }: HourGridProps) {
  const layout = layoutOverlappingEvents(
    events.map((e) => ({ id: e.id, start: new Date(e.start), end: new Date(e.end) })),
  );
  const layoutById = new Map(layout.map((l) => [l.id, l]));

  return (
    <div className="relative" style={{ height: HOUR_HEIGHT_PX * 24 }}>
      {Array.from({ length: 24 }, (_, hour) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-black/[.07] dark:border-white/[.1]"
          style={{ top: hour * HOUR_HEIGHT_PX }}
        >
          <span
            className="absolute -translate-y-1/2 text-right text-[11px] text-black/40 dark:text-white/40"
            style={{ left: 4, width: GUTTER_WIDTH_PX - 10 }}
          >
            {formatHour(hour)}
          </span>
        </div>
      ))}

      <div className="absolute inset-y-0" style={{ left: GUTTER_WIDTH_PX, right: 8 }}>
        {events.map((event) => {
          const l = layoutById.get(event.id);
          const calendar = calendarsById.get(event.calendarId);
          return (
            <EventBlock
              key={event.id}
              event={event}
              colorName={calendar?.color ?? "gray"}
              columnIndex={l?.columnIndex ?? 0}
              columnCount={l?.columnCount ?? 1}
              onClick={() => onSelectEvent?.(event)}
            />
          );
        })}
      </div>

      {isToday && <CurrentTimeLine />}
    </div>
  );
}
