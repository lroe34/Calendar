import type { CalendarEvent, CalendarSource, Reminder } from "@/lib/types";
import { CALENDAR_COLORS } from "@/lib/colors";
import { MONTH_ABBR, WEEKDAY_NAMES, getWeekLabel, isSameDay } from "@/lib/date-utils";
import { PinIcon, ReminderCircleIcon } from "@/components/shared/Icons";

interface CalendarListViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  reminders: Reminder[];
  calendars: CalendarSource[];
  topOffset: number;
  onSelectEvent: (event: CalendarEvent) => void;
}

function displayTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(" ", "");
}

export function CalendarListView({ selectedDate, events, reminders, calendars, topOffset, onSelectEvent }: CalendarListViewProps) {
  const calendarsById = new Map(calendars.map((calendar) => [calendar.id, calendar]));
  const datedItems = [
    ...events.map((event) => ({ date: new Date(event.start), event, reminder: null as Reminder | null })),
    ...reminders.filter((reminder) => reminder.due).map((reminder) => ({ date: new Date(reminder.due!), event: null as CalendarEvent | null, reminder })),
  ]
    .filter((item) => item.date.getTime() >= new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const groups = datedItems.reduce<{ date: Date; items: typeof datedItems }[]>((result, item) => {
    const group = result.find((candidate) => isSameDay(candidate.date, item.date));
    if (group) group.items.push(item);
    else result.push({ date: item.date, items: [item] });
    return result;
  }, []);

  return (
    <div className="no-scrollbar absolute inset-0 overflow-y-auto px-4 pb-28" style={{ paddingTop: topOffset + 24 }}>
      {groups.length === 0 && <p className="py-16 text-center text-black/40 dark:text-white/40">No upcoming events</p>}
      {groups.map((group) => (
        <section key={group.date.toDateString()} className="mb-8">
          <header className="border-b border-black/10 pb-2 dark:border-white/10">
            <h2 className="text-[21px] font-semibold text-black/55 dark:text-white/60">
              {WEEKDAY_NAMES[group.date.getDay()]} – {MONTH_ABBR[group.date.getMonth()]} {group.date.getDate()}
            </h2>
            <p className="text-[16px] text-black/45 dark:text-white/45">W{getWeekLabel(group.date)}</p>
          </header>
          <div>
            {group.items.map(({ event, reminder }) => {
              if (reminder) {
                return (
                  <div key={reminder.id} className="flex min-h-16 items-center gap-3 border-b border-black/10 px-2 dark:border-white/10">
                    <ReminderCircleIcon className="h-6 w-6 shrink-0 text-blue-500" />
                    <span className="min-w-0 flex-1 truncate text-[19px] text-black/45 dark:text-white/50">{reminder.title}</span>
                    <span className="text-[16px] text-black/35 dark:text-white/35">all-day</span>
                  </div>
                );
              }
              if (!event) return null;
              const calendar = calendarsById.get(event.calendarId);
              const color = CALENDAR_COLORS[calendar?.color ?? "gray"];
              return (
                <button key={event.id} onClick={() => onSelectEvent(event)} className="flex min-h-20 w-full items-center gap-3 border-b border-black/10 px-2 py-3 text-left active:bg-black/[.03] dark:border-white/10 dark:active:bg-white/[.04]">
                  <span className="h-14 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color.tint }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[19px] font-semibold text-black/65 dark:text-white/70">{event.title}</span>
                    {event.location && <span className="mt-0.5 flex items-center gap-1 truncate text-[16px] text-black/35 dark:text-white/40"><PinIcon className="h-4 w-4 shrink-0" />{event.location.name}</span>}
                  </span>
                  <span className="shrink-0 text-right text-[16px] leading-6 text-black/60 dark:text-white/65">
                    {event.isAllDay ? "all-day" : <>{displayTime(event.start)}<br /><span className="text-black/35 dark:text-white/40">{displayTime(event.end)}</span></>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
