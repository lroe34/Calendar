"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  /**
   * Viewport Y of each week day-number in the month view (Sun..Sat). Used to
   * match the scroll-content slide distance to how far those numbers travel
   * into the mini week strip. Null entries are blank/missing cells.
   */
  peerNumberTops: (number | null)[];
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
  onGridView?: () => void;
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
  onGridView,
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

  // The header (nav + mini strip + day heading + all-day lane) is pinned in
  // place, not part of the scroll flow, so the hour grid below needs its own
  // top offset kept in sync with the header's real (variable — the all-day
  // lane can wrap to multiple lines) height.
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    setHeaderHeight(el.getBoundingClientRect().height);
  }, [selectedDate.getTime(), allDayEvents.length, dayReminders.length]);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setHeaderHeight(entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chromeIsOff = transition ? (transition.mode === "exit" ? transition.armed : !transition.armed) : false;
  const chromeStyle = transition
    ? {
        opacity: chromeIsOff ? 0 : 1,
        transition: `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
      }
    : undefined;

  // Match the scroll-content slide to the flying day-numbers' vertical
  // travel (month week row ↔ mini week strip) so the grid appears to rise
  // and settle with the dates. Measured against the strip's resting layout —
  // the strip itself stays on chromeStyle (opacity-only, no transform)
  // because FlyingDayNumbers reads that resting position mid-transition.
  const [slideDistancePx, setSlideDistancePx] = useState(0);

  useLayoutEffect(() => {
    if (!transition) {
      setSlideDistancePx(0);
      return;
    }
    const tops = transition.peerNumberTops;
    const strip = headerRef.current?.querySelector<HTMLElement>("[data-cal-ministrip]");
    if (!strip || tops.length === 0) return;

    const nodes = strip.querySelectorAll<HTMLElement>("[data-cal-daynum]");
    for (let i = 0; i < nodes.length; i++) {
      const peerTop = tops[i];
      if (peerTop == null) continue;
      setSlideDistancePx(Math.abs(nodes[i].getBoundingClientRect().top - peerTop));
      return;
    }
  }, [transition]);

  const contentStyle = transition
    ? {
        opacity: chromeIsOff ? 0 : 1,
        transform: chromeIsOff ? `translateY(${slideDistancePx}px)` : "translateY(0)",
        transition: `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}, transform ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
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
      {/* The hour grid opts back into pointer events even mid-transition —
          scrolling (and the momentum it carries into the settled view)
          shouldn't have to wait for the flying-numbers animation to finish. */}
      <div
        ref={scrollRef}
        className="no-scrollbar pointer-events-auto absolute inset-0 overflow-y-auto pb-28"
        style={{ ...contentStyle, paddingTop: headerHeight }}
      >
        <HourGrid
          events={timedEvents}
          calendarsById={calendarsById}
          isToday={isToday}
          onSelectEvent={onSelectEvent}
        />
      </div>

      <div ref={headerRef} className="absolute inset-x-0 top-0 z-20">
        <div className="bg-white/70 backdrop-blur-xl dark:bg-black/60" style={navStyle}>
          <TopNavBar backLabel={MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)} onBack={onBack} />
        </div>
        {/* Backdrop lives here (not on the absolute wrapper) so it fades out
            with this chrome during a transition instead of staying opaque
            and covering the other view's header underneath for the whole
            transition. */}
        <div className="bg-white/70 backdrop-blur-xl dark:bg-black/60" style={chromeStyle}>
          <MiniWeekStrip
            selectedDate={selectedDate}
            today={today}
            onSelectDate={onSelectDate}
            hiddenDayKeys={transition?.hiddenDayKeys}
          />
          <DayHeading date={selectedDate} />
          <AllDayLane events={allDayEvents} reminders={dayReminders} calendarsById={calendarsById} />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20" style={navStyle}>
        <BottomBar onToday={() => onSelectDate(today)} onGridView={onGridView} />
      </div>
    </div>
  );
}
