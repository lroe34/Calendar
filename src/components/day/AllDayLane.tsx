import type { CalendarEvent, CalendarSource, Reminder } from "@/lib/types";
import { CALENDAR_COLORS } from "@/lib/colors";
import { ReminderCircleIcon, SmallCalendarIcon } from "@/components/shared/Icons";

interface AllDayLaneProps {
  events: CalendarEvent[];
  reminders: Reminder[];
  calendarsById: Map<string, CalendarSource>;
}

const PILL =
  "flex h-7 min-w-0 items-center gap-1.5 overflow-hidden rounded-full px-2.5 text-[13px] font-medium last:odd:col-span-2";

export function AllDayLane({ events, reminders, calendarsById }: AllDayLaneProps) {
  if (events.length === 0 && reminders.length === 0) return null;

  return (
    <div className="flex items-start gap-2 border-t border-black/[.06] px-4 py-2 dark:border-white/[.08]">
      <span className="shrink-0 pt-1.5 text-[12px] text-black/40 dark:text-white/40">all-day</span>
      {/* 2-col grid: odd last item spans full width. Max 2.5 rows, then scroll. */}
      <div className="no-scrollbar grid max-h-[calc(2.5*1.75rem+2*0.5rem)] flex-1 grid-cols-2 gap-2 overflow-y-auto">
        {events.map((event) => {
          const calendar = calendarsById.get(event.calendarId);
          const color = calendar ? CALENDAR_COLORS[calendar.color] : CALENDAR_COLORS.gray;
          return (
            <span
              key={event.id}
              className={PILL}
              style={{ backgroundColor: color.tint, color: color.text }}
            >
              <SmallCalendarIcon className="h-3.5 w-3.5 shrink-0" style={{ color: color.accent }} />
              <span className="truncate">{event.title}</span>
            </span>
          );
        })}
        {reminders.map((reminder) => (
          <span
            key={reminder.id}
            className={`${PILL} bg-black/[.05] text-black/50 dark:bg-white/10 dark:text-white/50`}
          >
            <ReminderCircleIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{reminder.title}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
