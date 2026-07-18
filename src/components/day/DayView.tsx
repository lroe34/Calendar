"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, TransitionEvent as ReactTransitionEvent } from "react";
import type { CalendarEvent, CalendarSource, Reminder } from "@/lib/types";
import { MONTH_NAMES, addDays, isSameDay, startOfDay } from "@/lib/date-utils";
import { TopNavBar } from "@/components/shared/TopNavBar";
import { BottomBar } from "@/components/shared/BottomBar";
import { TRANSITION_MS, TRANSITION_EASE } from "@/lib/transition-constants";
import { MiniWeekStrip } from "./MiniWeekStrip";
import { DayContentPane } from "./DayContentPane";

export interface DayViewTransition {
  mode: "exit" | "enter";
  armed: boolean;
  hiddenDayKeys: Set<string>;
  /**
   * Vertical travel of the flying day-numbers (month ↔ mini strip), or null
   * until both ends have been measured. Content slides by this same distance.
   */
  slideDistancePx: number | null;
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

/** Day-to-day horizontal navigation, either a live finger drag or a
 *  programmatic jump (mini-strip tap, Today button). Both funnel through the
 *  same slide so navigating several days away is one continuous motion —
 *  never a series of per-day hops through the dates in between. */
interface SwipeState {
  neighborDate: Date;
  direction: 1 | -1; // 1 = neighbor is later (content slides left), -1 = earlier (slides right)
  offsetPx: number;
  /** "pending": just armed for a programmatic jump, one frame before the
   *  transition kicks in. "drag": tracking the pointer 1:1, no transition.
   *  "settling": animating to rest (commit or cancel). */
  phase: "pending" | "drag" | "settling";
  /** Whether reaching the settle target should commit (call onSelectDate). */
  pendingCommit: boolean;
}

const SWIPE_LOCK_THRESHOLD_PX = 8;
const SWIPE_COMMIT_RATIO = 0.3;

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

  // The pinned chrome (nav bar + mini week strip) sits above the swipeable
  // day panes; its height tells each pane where its own content starts.
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    setHeaderHeight(el.getBoundingClientRect().height);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setHeaderHeight(entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = swipeContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const getContainerWidth = () =>
    containerWidth || swipeContainerRef.current?.getBoundingClientRect().width || window.innerWidth;

  const [swipe, setSwipe] = useState<SwipeState | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    locked: "x" | "y" | null;
  } | null>(null);

  // Programmatic jump (mini strip tap, Today button): arm a slide toward
  // `date` in a single motion, whatever the distance, rather than updating
  // selectedDate directly (which would just snap with no transition, or —
  // if callers stepped through it themselves — hop day by day).
  function navigateTo(date: Date) {
    const target = startOfDay(date);
    if (transition || swipe) return;
    if (isSameDay(target, selectedDate)) return;
    const direction: 1 | -1 = target.getTime() > selectedDate.getTime() ? 1 : -1;
    setSwipe({ neighborDate: target, direction, offsetPx: 0, phase: "pending", pendingCommit: true });
  }

  // Arms the programmatic jump a frame after mount so the browser observes
  // the neighbor pane's off-screen starting frame before animating it in.
  useLayoutEffect(() => {
    if (!swipe || swipe.phase !== "pending") return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setSwipe((s) => {
          if (!s || s.phase !== "pending") return s;
          return { ...s, phase: "settling", offsetPx: -s.direction * getContainerWidth() };
        });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipe?.phase === "pending"]);

  function handlePointerDown(e: ReactPointerEvent) {
    if (transition) return;
    if (swipe) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, locked: null };
  }

  function handlePointerMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.locked === null) {
      if (Math.abs(dx) < SWIPE_LOCK_THRESHOLD_PX && Math.abs(dy) < SWIPE_LOCK_THRESHOLD_PX) return;
      d.locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.locked === "x") {
        const direction: 1 | -1 = dx < 0 ? 1 : -1;
        setSwipe({
          neighborDate: addDays(selectedDate, direction),
          direction,
          offsetPx: 0,
          phase: "drag",
          pendingCommit: false,
        });
      }
    }
    if (d.locked !== "x") return;
    const w = getContainerWidth();
    setSwipe((s) => {
      if (!s || s.phase !== "drag") return s;
      // Clamp to the locked direction's half of the range: dragging back
      // past the resting position would otherwise slide the base pane the
      // "wrong" way with nothing mounted behind it.
      const [lo, hi] = s.direction === 1 ? [-w, 0] : [0, w];
      return { ...s, offsetPx: Math.max(lo, Math.min(hi, dx)) };
    });
  }

  function settleDrag(commit: boolean) {
    setSwipe((s) => {
      if (!s || s.phase !== "drag") return s;
      const w = getContainerWidth();
      return { ...s, phase: "settling", offsetPx: commit ? -s.direction * w : 0, pendingCommit: commit };
    });
  }

  function handlePointerUp(e: ReactPointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.pointerId !== e.pointerId || d.locked !== "x") return;
    const w = getContainerWidth();
    const dx = e.clientX - d.startX;
    settleDrag(Math.abs(dx) / w > SWIPE_COMMIT_RATIO);
  }

  function handlePointerCancel(e: ReactPointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.pointerId !== e.pointerId || d.locked !== "x") return;
    settleDrag(false);
  }

  // Fires when the base pane's own transform transition ends (only active
  // during "settling"; drag/pending render with transition: none, so this
  // can't fire mid-drag). Guarded to this element's own transform so a
  // bubbled transitionend from unrelated child animations can't trigger it.
  function handleSettleEnd(e: ReactTransitionEvent) {
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
    if (!swipe || swipe.phase !== "settling") return;
    const { pendingCommit, neighborDate } = swipe;
    setSwipe(null);
    if (pendingCommit) onSelectDate(neighborDate);
  }

  const paneTransition = swipe?.phase === "settling" ? `transform ${TRANSITION_MS}ms ${TRANSITION_EASE}` : "none";
  const baseX = swipe ? swipe.offsetPx : 0;
  const neighborX = swipe ? swipe.offsetPx + swipe.direction * containerWidth : 0;

  const chromeIsOff = transition ? (transition.mode === "exit" ? transition.armed : !transition.armed) : false;
  const chromeStyle = transition
    ? { opacity: chromeIsOff ? 0 : 1, transition: `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}` }
    : undefined;

  return (
    <div className={`fixed inset-0 overflow-hidden ${transition ? "pointer-events-none" : ""}`}>
      <div
        ref={swipeContainerRef}
        className="pointer-events-auto absolute inset-0"
        style={{ touchAction: "pan-y" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className="absolute inset-0"
          style={{ transform: `translateX(${baseX}px)`, transition: paneTransition }}
          onTransitionEnd={handleSettleEnd}
        >
          <DayContentPane
            date={selectedDate}
            today={today}
            events={events}
            reminders={reminders}
            calendarsById={calendarsById}
            onSelectEvent={onSelectEvent}
            topOffset={headerHeight}
            verticalTransition={
              transition
                ? {
                    mode: transition.mode,
                    armed: transition.armed,
                    slideDistancePx: transition.slideDistancePx,
                  }
                : null
            }
          />
        </div>

        {swipe && (
          <div
            className="absolute inset-0"
            style={{ transform: `translateX(${neighborX}px)`, transition: paneTransition }}
          >
            <DayContentPane
              date={swipe.neighborDate}
              today={today}
              events={events}
              reminders={reminders}
              calendarsById={calendarsById}
              onSelectEvent={onSelectEvent}
              topOffset={headerHeight}
              verticalTransition={null}
            />
          </div>
        )}
      </div>

      <div ref={headerRef} className="absolute inset-x-0 top-0 z-20">
        {/* Pinned chrome: nav band + mini strip only. Day heading / all-day
            lane now live inside each swipeable DayContentPane so they slide
            with the hour grid instead of snapping. */}
        <div className="bg-white/60 backdrop-blur-sm dark:bg-black/60" style={chromeStyle}>
          <div className="invisible" aria-hidden>
            <TopNavBar backLabel={MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)} onBack={onBack} />
          </div>
          <MiniWeekStrip
            selectedDate={selectedDate}
            today={today}
            onSelectDate={navigateTo}
            hiddenDayKeys={transition?.hiddenDayKeys}
          />
        </div>
      </div>

      <div className="absolute inset-x-0 top-0 z-40" style={chromeStyle}>
        <TopNavBar backLabel={MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)} onBack={onBack} />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-40" style={chromeStyle}>
        <BottomBar onToday={() => navigateTo(today)} onGridView={onGridView} />
      </div>
    </div>
  );
}
