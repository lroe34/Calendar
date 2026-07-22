"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CalendarEvent, CalendarSource, Reminder } from "@/lib/types";
import { isSameDay } from "@/lib/date-utils";
import { HOUR_HEIGHT_PX } from "@/lib/day-grid";
import { TRANSITION_MS, TRANSITION_EASE } from "@/lib/transition-constants";
import { DayHeading } from "./DayHeading";
import { AllDayLane } from "./AllDayLane";
import { HourGrid, type EventLongPressInfo, type GhostSpec } from "./HourGrid";

/** Vertical month-week &lt;-&gt; mini-strip transition, forwarded from DayView's
 *  own `transition` prop. Only ever set on the pane matching the live
 *  selected date — day-to-day swiping and this transition never overlap. */
export interface DayPaneVerticalTransition {
  mode: "exit" | "enter";
  armed: boolean;
  slideDistancePx: number | null;
}

interface DayContentPaneProps {
  date: Date;
  today: Date;
  events: CalendarEvent[];
  reminders: Reminder[];
  calendarsById: Map<string, CalendarSource>;
  onSelectEvent: (event: CalendarEvent) => void;
  /** On-grid edit (move/resize) is owned by DayView; the pane just forwards
   *  the long-press pickup and renders the ghost for its own day. */
  editingEventId?: string | null;
  ghost?: GhostSpec | null;
  onEventLongPress?: (info: EventLongPressInfo) => void;
  /** Height of the pinned chrome (nav spacer + mini week strip) this pane sits below. */
  topOffset: number;
  verticalTransition?: DayPaneVerticalTransition | null;
  /** While an on-grid edit is live, lock this pane's vertical scroll so a drag
   *  retimes the event instead of scrolling the grid underneath the pinned copy. */
  scrollLocked?: boolean;
  /** DayView owns the on-grid edit gesture but needs this pane's scroll element
   *  to read/drive it — bounding the pinned copy to the visible grid and
   *  edge-auto-scrolling. Only the base (selected-day) pane forwards it. */
  scrollContainerRef?: React.MutableRefObject<HTMLDivElement | null>;
}

export function DayContentPane({
  date,
  today,
  events,
  reminders,
  calendarsById,
  onSelectEvent,
  editingEventId = null,
  ghost = null,
  onEventLongPress,
  topOffset,
  verticalTransition = null,
  scrollLocked = false,
  scrollContainerRef,
}: DayContentPaneProps) {
  const isToday = isSameDay(date, today);

  const allDayEvents = useMemo(
    () =>
      events.filter((e) => {
        if (!e.isAllDay) return false;
        const start = new Date(e.start);
        const end = new Date(e.end);
        return start.getTime() <= date.getTime() && end.getTime() >= date.getTime();
      }),
    [events, date],
  );

  const dayReminders = useMemo(
    () => reminders.filter((r) => r.due && isSameDay(new Date(r.due), date)),
    [reminders, date],
  );

  const timedEvents = useMemo(
    () => events.filter((e) => !e.isAllDay && isSameDay(new Date(e.start), date)),
    [events, date],
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  // Assign the scroll element to both the internal ref (used by this pane's own
  // layout effects) and the ref DayView passes down for its on-grid edit.
  const setScrollRef = (el: HTMLDivElement | null) => {
    scrollRef.current = el;
    if (scrollContainerRef) scrollContainerRef.current = el;
  };

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const scrollToMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : 8 * 60;
    const target = Math.max(0, (scrollToMinutes / 60) * HOUR_HEIGHT_PX - 120);
    container.scrollTop = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date.getTime()]);

  // The day heading + all-day lane are pinned above the scrollable hour grid
  // (not part of the scroll flow), so the grid needs its own top offset kept
  // in sync with their real (variable — the all-day lane can wrap) height.
  const subHeaderRef = useRef<HTMLDivElement>(null);
  const [subHeaderHeight, setSubHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const el = subHeaderRef.current;
    if (!el) return;
    setSubHeaderHeight(el.getBoundingClientRect().height);
  }, [date.getTime(), allDayEvents.length, dayReminders.length]);

  useEffect(() => {
    const el = subHeaderRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSubHeaderHeight(entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Both enter and exit use WAAPI so they share the same animation driver as
  // FlyingDayNumbers — identical engine, easing, and start frame across the
  // full 400ms. See DayView's former inline copy of this for the fuller
  // rationale. The header's own fade (background + text together) is a
  // plain CSS opacity transition below (subHeaderStyle), same technique as
  // DayView's chrome fade; headerContentRef only slides (WAAPI transform).
  const contentAnimRef = useRef<Animation | null>(null);
  const headerContentRef = useRef<HTMLDivElement>(null);
  const headerContentAnimRef = useRef<Animation | null>(null);
  const hasStartedEnterAnimRef = useRef(false);
  const [enterAnimStarted, setEnterAnimStarted] = useState(false);
  const hasStartedExitAnimRef = useRef(false);

  useLayoutEffect(() => {
    if (
      !verticalTransition ||
      verticalTransition.mode !== "enter" ||
      verticalTransition.slideDistancePx == null ||
      !verticalTransition.armed
    ) {
      return;
    }
    if (hasStartedEnterAnimRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    hasStartedEnterAnimRef.current = true;
    const anim = el.animate(
      [
        { transform: `translateY(${verticalTransition.slideDistancePx}px)`, opacity: 0 },
        { transform: "translateY(0px)", opacity: 1 },
      ],
      { duration: TRANSITION_MS, easing: TRANSITION_EASE },
    );
    contentAnimRef.current = anim;
    setEnterAnimStarted(true);
    anim.finished.then(() => anim.cancel()).catch(() => {});

    const headerAnim = headerContentRef.current?.animate(
      [
        { transform: `translateY(${verticalTransition.slideDistancePx}px)` },
        { transform: "translateY(0px)" },
      ],
      { duration: TRANSITION_MS, easing: TRANSITION_EASE },
    );
    if (headerAnim) {
      headerContentAnimRef.current = headerAnim;
      headerAnim.finished.then(() => headerAnim.cancel()).catch(() => {});
    }
  }, [verticalTransition]);

  useLayoutEffect(() => {
    if (
      !verticalTransition ||
      verticalTransition.mode !== "exit" ||
      verticalTransition.slideDistancePx == null ||
      !verticalTransition.armed
    ) {
      return;
    }
    if (hasStartedExitAnimRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    hasStartedExitAnimRef.current = true;

    const anim = el.animate(
      [
        { transform: "translateY(0px)", opacity: 1 },
        { transform: `translateY(${verticalTransition.slideDistancePx}px)`, opacity: 0 },
      ],
      { duration: TRANSITION_MS, easing: TRANSITION_EASE, fill: "forwards" },
    );
    contentAnimRef.current = anim;

    const headerAnim = headerContentRef.current?.animate(
      [
        { transform: "translateY(0px)" },
        { transform: `translateY(${verticalTransition.slideDistancePx}px)` },
      ],
      { duration: TRANSITION_MS, easing: TRANSITION_EASE, fill: "forwards" },
    );
    if (headerAnim) headerContentAnimRef.current = headerAnim;
  }, [verticalTransition]);

  useEffect(() => {
    return () => {
      contentAnimRef.current?.cancel();
      contentAnimRef.current = null;
      headerContentAnimRef.current?.cancel();
      headerContentAnimRef.current = null;
    };
  }, []);

  const isEnterAwaitingAnimation = verticalTransition?.mode === "enter" && !enterAnimStarted;
  const contentStyle = verticalTransition
    ? verticalTransition.mode === "enter"
      ? { opacity: isEnterAwaitingAnimation ? 0 : undefined, transform: undefined, transition: "none" }
      : { transition: "none" }
    : undefined;

  const headerContentStyle = verticalTransition
    ? verticalTransition.mode === "enter"
      ? { transform: undefined, transition: "none" }
      : { transition: "none" }
    : undefined;

  const chromeIsOff = verticalTransition
    ? verticalTransition.mode === "exit"
      ? verticalTransition.armed
      : !verticalTransition.armed
    : false;
  const subHeaderStyle = verticalTransition
    ? {
        top: topOffset,
        opacity: chromeIsOff ? 0 : 1,
        transition: `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
      }
    : { top: topOffset };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        ref={setScrollRef}
        className="no-scrollbar pointer-events-auto absolute inset-0 overflow-y-auto pb-28 mt-3"
        style={{
          ...contentStyle,
          paddingTop: topOffset + subHeaderHeight,
          // Locked during an on-grid edit so the drag can't native-scroll the
          // grid out from under the pinned copy (touch-action alone can't stop
          // a scroll the browser already latched at touchstart).
          ...(scrollLocked ? { overflowY: "hidden" as const, touchAction: "none" as const } : null),
        }}
      >
        <HourGrid
          events={timedEvents}
          calendarsById={calendarsById}
          isToday={isToday}
          onSelectEvent={onSelectEvent}
          editingEventId={editingEventId}
          ghost={ghost}
          onEventLongPress={onEventLongPress}
        />
      </div>

      <div
        ref={subHeaderRef}
        className="absolute inset-x-0 z-10 border-b border-black/[.06] bg-white/60 backdrop-blur-sm dark:border-white/[.08] dark:bg-black/60"
        style={subHeaderStyle}
      >
        <div ref={headerContentRef} style={headerContentStyle}>
          <DayHeading date={date} />
          <AllDayLane events={allDayEvents} reminders={dayReminders} calendarsById={calendarsById} />
        </div>
      </div>
    </div>
  );
}
