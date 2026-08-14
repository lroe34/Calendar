"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CalendarEvent, CalendarSource, Reminder } from "@/lib/types";
import { isSameDay } from "@/lib/date-utils";
import { timedEventDaySegment } from "@/lib/day-grid";
import { TRANSITION_MS, TRANSITION_EASE } from "@/lib/transition-constants";
import { DayHeading } from "./DayHeading";
import { AllDayLane } from "./AllDayLane";
import { useHourHeight } from "./DayScaleContext";
import { HourGrid, type EmptyGridPressInfo, type EventLongPressInfo, type GhostSpec } from "./HourGrid";

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
  onEmptyGridPress?: (info: EmptyGridPressInfo) => void;
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
  /** Desktop week view registers every column here so one vertical scroll can
   *  be mirrored across the whole week. */
  synchronizedScrollContainers?: React.MutableRefObject<Set<HTMLDivElement>>;
  /** Last scroll offset shared by every mounted/current/incoming pane. Reading
   * it in the ref callback initializes a new pane before the browser paints,
   * avoiding a one-frame flash at midnight during day/week navigation. */
  sharedScrollTopRef?: React.MutableRefObject<number | null>;
  /** The per-day heading is redundant when the week strip labels each column. */
  hideDayHeading?: boolean;
  initializeScroll?: boolean;
  showTimeGutter?: boolean;
  showCurrentTime?: boolean;
  sharedSubHeaderHeight?: number;
  onSubHeaderHeightChange?: (height: number) => void;
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
  onEmptyGridPress,
  topOffset,
  verticalTransition = null,
  scrollLocked = false,
  scrollContainerRef,
  synchronizedScrollContainers,
  sharedScrollTopRef,
  hideDayHeading = false,
  initializeScroll = true,
  showTimeGutter = true,
  showCurrentTime,
  sharedSubHeaderHeight,
  onSubHeaderHeightChange,
}: DayContentPaneProps) {
  const isToday = isSameDay(date, today);
  const hourHeight = useHourHeight();

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

  // A timed event appears on every day its interval touches, not just the day
  // it starts — so an event running from one day into the next is drawn on
  // both (clipped to each day's midnight bounds by HourGrid).
  const timedEvents = useMemo(
    () => events.filter((e) => !e.isAllDay && timedEventDaySegment(e.start, e.end, date) !== null),
    [events, date],
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  // Assign the scroll element to both the internal ref (used by this pane's own
  // layout effects) and the ref DayView passes down for its on-grid edit.
  const setScrollRef = (el: HTMLDivElement | null) => {
    if (scrollRef.current) synchronizedScrollContainers?.current.delete(scrollRef.current);
    scrollRef.current = el;
    if (el && sharedScrollTopRef?.current !== null && sharedScrollTopRef?.current !== undefined) {
      el.scrollTop = sharedScrollTopRef.current;
    }
    if (el && synchronizedScrollContainers) {
      // A neighboring week mounts only after a horizontal swipe starts. Give
      // each of its columns the already-visible week's scroll position before
      // the first paint instead of briefly showing midnight (or running its
      // own per-date initial scroll and changing the visible week).
      const existingContainer = synchronizedScrollContainers.current.values().next().value;
      if (existingContainer) el.scrollTop = existingContainer.scrollTop;
      synchronizedScrollContainers.current.add(el);
    }
    if (scrollContainerRef) scrollContainerRef.current = el;
  };

  const handleScroll = () => {
    const source = scrollRef.current;
    if (!source) return;
    if (sharedScrollTopRef) sharedScrollTopRef.current = source.scrollTop;
    if (!synchronizedScrollContainers) return;
    synchronizedScrollContainers.current.forEach((container) => {
      if (container !== source && container.scrollTop !== source.scrollTop) {
        container.scrollTop = source.scrollTop;
      }
    });
  };

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || !initializeScroll) return;
    // Once the day view has established a scroll position, navigation should
    // preserve it. Re-running the date-focused default here would overwrite
    // the correctly initialized incoming pane at the end of the swipe and
    // produce the visible second jump.
    if (sharedScrollTopRef?.current !== null && sharedScrollTopRef?.current !== undefined) {
      container.scrollTop = sharedScrollTopRef.current;
      return;
    }
    const scrollToMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : 8 * 60;
    // Uses the current hour height (not the default) so a mid-zoom day change
    // still lands at the right time; intentionally not a dep — zooming must not
    // re-run this and yank the scroll position.
    const target = Math.max(0, (scrollToMinutes / 60) * hourHeight - 120);
    container.scrollTop = target;
    if (sharedScrollTopRef) sharedScrollTopRef.current = target;
    synchronizedScrollContainers?.current.forEach((peer) => {
      if (peer !== container) peer.scrollTop = target;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date.getTime(), initializeScroll]);

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
    const el = headerContentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const height = entry.contentRect.height;
      setSubHeaderHeight(height);
      onSubHeaderHeightChange?.(height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onSubHeaderHeightChange]);

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
        onScroll={handleScroll}
        style={{
          ...contentStyle,
          paddingTop: topOffset + (sharedSubHeaderHeight ?? subHeaderHeight),
          // Locked during an on-grid edit so the drag can't native-scroll the
          // grid out from under the pinned copy (touch-action alone can't stop
          // a scroll the browser already latched at touchstart).
          ...(scrollLocked ? { overflowY: "hidden" as const, touchAction: "none" as const } : null),
        }}
      >
        <HourGrid
          date={date}
          events={timedEvents}
          calendarsById={calendarsById}
          isToday={isToday}
          onSelectEvent={onSelectEvent}
          editingEventId={editingEventId}
          ghost={ghost}
          onEventLongPress={onEventLongPress}
          onEmptyGridPress={onEmptyGridPress}
          showTimeGutter={showTimeGutter}
          showCurrentTime={showCurrentTime}
        />
      </div>

      <div
        ref={subHeaderRef}
        className="absolute inset-x-0 z-10 border-b border-black/[.06] bg-white/60 backdrop-blur-sm dark:border-white/[.08] dark:bg-black/60"
        style={{ ...subHeaderStyle, minHeight: sharedSubHeaderHeight }}
      >
        <div ref={headerContentRef} style={headerContentStyle}>
          {!hideDayHeading && <DayHeading date={date} />}
          <AllDayLane events={allDayEvents} reminders={dayReminders} calendarsById={calendarsById} />
        </div>
      </div>
    </div>
  );
}
