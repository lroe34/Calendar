import type { CalendarEvent, CalendarSource, Reminder } from "@/lib/types";
import { CALENDAR_COLORS } from "@/lib/colors";
import { ReminderCircleIcon, SmallCalendarIcon } from "@/components/shared/Icons";

interface AllDayLaneProps {
  events: CalendarEvent[];
  reminders: Reminder[];
  calendarsById: Map<string, CalendarSource>;
}

export function AllDayLane({ events, reminders, calendarsById }: AllDayLaneProps) {
  if (events.length === 0 && reminders.length === 0) return null;

  return (
    <div className="flex items-center gap-2 border-t border-black/[.06] px-4 py-2 dark:border-white/[.08]">
      <span className="text-[12px] text-black/40 dark:text-white/40">all-day</span>
      <div className="flex flex-1 flex-wrap gap-2">
        {events.map((event) => {
          const calendar = calendarsById.get(event.calendarId);
          const color = calendar ? CALENDAR_COLORS[calendar.color] : CALENDAR_COLORS.gray;
          return (
            <span
              key={event.id}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium"
              style={{ backgroundColor: color.tint, color: color.text }}
            >
              <SmallCalendarIcon className="h-3.5 w-3.5" style={{ color: color.accent }} />
              {event.title}
            </span>
          );
        })}
        {reminders.map((reminder) => (
          <span
            key={reminder.id}
            className="flex items-center gap-1.5 rounded-full bg-black/[.05] px-2.5 py-1 text-[13px] text-black/50 dark:bg-white/10 dark:text-white/50"
          >
            <ReminderCircleIcon className="h-3.5 w-3.5" />
            {reminder.title}
          </span>
        ))}
      </div>
    </div>
  );
}
