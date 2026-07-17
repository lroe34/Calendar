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
  // travel (month week ↔ mini strip), so the grid appears to rise with the
  // dates. Distance comes from the same fromRects/toRects FlyingDayNumbers
  // uses — not a local re-measure — so the motions stay locked.
  //
  // The entering case is driven imperatively via the Web Animations API
  // instead of a declarative CSS transition. A CSS transition here would
  // need the browser to have actually painted the pre-animation ("off")
  // frame before the armed flip changes it — normally guaranteed by
  // waiting two requestAnimationFrame ticks, but this element is a brand
  // -new mount with a lot of subtree to lay out, and under real-world load
  // (HMR, devtools, a slow machine) those two rAFs can both fire before the
  // browser gets an actual paint in between, silently skipping the
  // animation entirely. WAAPI's animate() starts playing on its own timeline
  // the instant it's called, with no dependency on paint timing.
  //
  // Exiting content has no such race — it's already an existing, painted
  // element — so it keeps the simpler declarative transition.
  const contentAnimRef = useRef<Animation | null>(null);
  // Mirrors contentAnimRef for the day-heading/all-day-lane group, which
  // slides in lockstep with the scroll content (same distance, duration,
  // easing) but leaves its fade to the shared chrome opacity transition
  // below — it already lives inside that fading backdrop, so animating
  // opacity here too would just double up on it.
  const headerContentRef = useRef<HTMLDivElement>(null);
  const headerContentAnimRef = useRef<Animation | null>(null);
  // Guards against re-triggering: CalendarApp hands down a fresh `transition`
  // object reference on every armed/etc. change, so this can't key off
  // object identity — it needs to fire exactly once per DayView mount (each
  // enter transition is itself a fresh mount, so a plain boolean is enough).
  const hasStartedEnterAnimRef = useRef(false);
  // Mirrors contentAnimRef into state so starting the animation actually
  // triggers the re-render that clears the placeholder below — a ref write
  // alone is invisible to React and never repaints. Without this, the
  // placeholder's inline opacity: 0 stays on the element for the whole
  // animation; once WAAPI's own effect is cancelled on finish, the element
  // reverts to that stale opacity: 0 instead of the neutral value, flashing
  // the content invisible right as the animation settles.
  const [enterAnimStarted, setEnterAnimStarted] = useState(false);

  useLayoutEffect(() => {
    // Wait for `armed` so this starts in the same commit as FlyingDayNumbers
    // (and the selected week's exit). Starting on slideDistancePx alone races
    // ahead of the double-rAF arm in CalendarApp.
    if (
      !transition ||
      transition.mode !== "enter" ||
      transition.slideDistancePx == null ||
      !transition.armed
    ) {
      return;
    }
    if (hasStartedEnterAnimRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    hasStartedEnterAnimRef.current = true;
    const anim = el.animate(
      [
        { transform: `translateY(${transition.slideDistancePx}px)`, opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: TRANSITION_MS, easing: TRANSITION_EASE },
    );
    contentAnimRef.current = anim;
    setEnterAnimStarted(true);
    anim.finished.then(() => anim.cancel()).catch(() => {});

    const headerAnim = headerContentRef.current?.animate(
      [{ transform: `translateY(${transition.slideDistancePx}px)` }, { transform: "translateY(0)" }],
      { duration: TRANSITION_MS, easing: TRANSITION_EASE },
    );
    if (headerAnim) {
      headerContentAnimRef.current = headerAnim;
      headerAnim.finished.then(() => headerAnim.cancel()).catch(() => {});
    }
  }, [transition]);

  useEffect(() => {
    return () => {
      contentAnimRef.current?.cancel();
      contentAnimRef.current = null;
      headerContentAnimRef.current?.cancel();
      headerContentAnimRef.current = null;
    };
  }, []);

  const isEnterAwaitingAnimation = transition?.mode === "enter" && !enterAnimStarted;
  const contentStyle = transition
    ? transition.mode === "enter"
      ? // Neutral placeholder until the WAAPI animation takes over (which,
        // once playing, overrides these inline values for its properties).
        { opacity: isEnterAwaitingAnimation ? 0 : undefined, transform: undefined, transition: "none" }
      : {
          opacity: chromeIsOff ? 0 : 1,
          transform: chromeIsOff ? `translateY(${transition.slideDistancePx ?? 0}px)` : "translateY(0)",
          transition: `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}, transform ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
        }
    : undefined;

  // Transform-only counterpart of contentStyle for the day-heading/all-day
  // -lane group: same slide, but no opacity of its own since the wrapping
  // backdrop below already fades it via chromeStyle.
  const headerContentStyle = transition
    ? transition.mode === "enter"
      ? { transform: undefined, transition: "none" }
      : {
          transform: chromeIsOff ? `translateY(${transition.slideDistancePx ?? 0}px)` : "translateY(0)",
          transition: `transform ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
        }
    : undefined;

  // Top/bottom toolbars crossfade with the rest of the chrome (back label
  // included) rather than freezing on the exiting copy. z-40 keeps them
  // above sliding month "after" rows when this layer is on top; when it's
  // underneath, the other view's fading toolbar leaves a hole so this one
  // can show through.
  const navStyle = chromeStyle;

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
        {/* Invisible twin reserves height for the absolute z-40 toolbar. */}
        <div className="invisible" aria-hidden>
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
          <div ref={headerContentRef} style={headerContentStyle}>
            <DayHeading date={selectedDate} />
            <AllDayLane events={allDayEvents} reminders={dayReminders} calendarsById={calendarsById} />
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-0 z-40" style={navStyle}>
        <div className="bg-white/70 backdrop-blur-xl dark:bg-black/60">
          <TopNavBar backLabel={MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)} onBack={onBack} />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-40" style={navStyle}>
        <BottomBar onToday={() => onSelectDate(today)} onGridView={onGridView} />
      </div>
    </div>
  );
}
