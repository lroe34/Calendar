"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CalendarEvent, CalendarSource, Reminder } from "@/lib/types";
import { MONTH_NAMES, isSameDay } from "@/lib/date-utils";
import { HOUR_HEIGHT_PX } from "@/lib/day-grid";
import { TopNavBar } from "@/components/shared/TopNavBar";
import { BottomBar } from "@/components/shared/BottomBar";
import { TRANSITION_MS, TRANSITION_EASE } from "@/lib/transition-constants";
import { MiniWeekStrip } from "./MiniWeekStrip";
import { DayHeading } from "./DayHeading";
import { AllDayLane } from "./AllDayLane";
import { HourGrid } from "./HourGrid";

export interface DayViewTransition {
  mode: "exit" | "enter";
  armed: boolean;
  hiddenDayKeys: Set<string>;
}

interface DayViewProps {
  today: Date;
  selectedDate: Date;
  events: CalendarEvent[];
  reminders: Reminder[];
  calendars: CalendarSource[];
  onSelectDate: (date: Date) => void;
  onBack: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
  transition?: DayViewTransition | null;
}

export function DayView({
  today,
  selectedDate,
  events,
  reminders,
  calendars,
  onSelectDate,
  onBack,
  onSelectEvent,
  transition = null,
}: DayViewProps) {
  const calendarsById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);
  const isToday = isSameDay(selectedDate, today);

  const allDayEvents = useMemo(
    () =>
      events.filter((e) => {
        if (!e.isAllDay) return false;
        const start = new Date(e.start);
        const end = new Date(e.end);
        return start.getTime() <= selectedDate.getTime() && end.getTime() >= selectedDate.getTime();
      }),
    [events, selectedDate],
  );

  const dayReminders = useMemo(
    () =>
      reminders.filter((r) => r.due && isSameDay(new Date(r.due), selectedDate)),
    [reminders, selectedDate],
  );

  const timedEvents = useMemo(
    () => events.filter((e) => !e.isAllDay && isSameDay(new Date(e.start), selectedDate)),
    [events, selectedDate],
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const scrollToMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : 8 * 60;
    const target = Math.max(0, (scrollToMinutes / 60) * HOUR_HEIGHT_PX - 120);
    container.scrollTop = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate.getTime()]);

  const chromeIsOff = transition ? (transition.mode === "exit" ? transition.armed : !transition.armed) : false;
  const chromeStyle = transition
    ? {
        opacity: chromeIsOff ? 0 : 1,
        transition: `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
      }
    : undefined;

  // The nav bar and bottom bar are pixel-identical, same-position UI chrome
  // in both views, so they must never fade/move — only one copy (the
  // exiting view's) stays visible; the entering view's copy stays invisible
  // (but still laid out, to avoid a layout jump) until the transition ends
  // and this view takes over for real.
  const navVisible = !transition || transition.mode === "exit";
  const navStyle = transition ? { opacity: navVisible ? 1 : 0, pointerEvents: navVisible ? undefined : ("none" as const) } : undefined;

  return (
    <div className={`fixed inset-0 overflow-hidden ${transition ? "pointer-events-none" : ""}`}>
      <div
        ref={scrollRef}
        className="no-scrollbar absolute inset-0 overflow-y-auto pb-28 pt-32"
        style={chromeStyle}
      >
        <DayHeading date={selectedDate} />
        <AllDayLane events={allDayEvents} reminders={dayReminders} calendarsById={calendarsById} />
        <HourGrid
          events={timedEvents}
          calendarsById={calendarsById}
          isToday={isToday}
          onSelectEvent={onSelectEvent}
        />
      </div>

      <div className="absolute inset-x-0 top-0 z-20 bg-white/70 backdrop-blur-xl dark:bg-black/60">
        <div style={navStyle}>
          <TopNavBar backLabel={MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)} onBack={onBack} />
        </div>
        <div style={chromeStyle}>
          <MiniWeekStrip
            selectedDate={selectedDate}
            today={today}
            onSelectDate={onSelectDate}
            hiddenDayKeys={transition?.hiddenDayKeys}
          />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20" style={navStyle}>
        <BottomBar onToday={() => onSelectDate(today)} />
      </div>
    </div>
  );
}
