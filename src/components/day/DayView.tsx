"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
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
 *  never a series of per-day hops through the dates in between.
 *
 *  Only the two pieces of state that need to *mount a pane* live in React
 *  state (which day the neighbor pane shows, which side it's on). The live
 *  animated offset lives in a ref and is written straight to the DOM every
 *  frame — like a real scroll view's display-link-driven scrolling — so a
 *  drag or a spring settle never triggers a React re-render of the event
 *  grid underneath it. */
interface SwipeState {
  neighborDate: Date;
  direction: 1 | -1; // 1 = neighbor is later (content slides left), -1 = earlier (slides right)
}

type SwipePhase = "idle" | "pending" | "drag" | "settling";

interface DragTrackState {
  pointerId: number;
  startX: number;
  startY: number;
  locked: "x" | "y" | null;
  direction: 1 | -1 | null;
  /** offsetPx at the moment this drag/re-grab started; move deltas are added to it. */
  baseOffsetPx: number;
  /** Rolling (x, t) samples for release-velocity estimation. */
  samples: { x: number; t: number }[];
}

const SWIPE_LOCK_THRESHOLD_PX = 8;
// iOS paging scroll views commit past the halfway point...
const SWIPE_COMMIT_DISTANCE_RATIO = 0.5;
// ...or on any decisive flick, regardless of how far it's traveled yet — a
// quick 20px flick should turn the page just as a slow 300px drag does.
const SWIPE_COMMIT_VELOCITY_PX_PER_MS = 0.5;
const VELOCITY_SAMPLE_WINDOW_MS = 80;

// Mirrors SwiftUI's `interactiveSpring(response:dampingFraction:)`: response
// is roughly "seconds to settle", dampingFraction near 1 avoids visible
// overshoot/bounce. Converted to a mass(=1)/stiffness/damping model so the
// settle can be driven frame-by-frame from the finger's real release
// velocity instead of a fixed-duration easing curve.
const SPRING_RESPONSE_S = 0.3;
const SPRING_DAMPING_FRACTION = 0.86;
const SPRING_ANGULAR_FREQUENCY = (2 * Math.PI) / SPRING_RESPONSE_S;
const SPRING_STIFFNESS = SPRING_ANGULAR_FREQUENCY ** 2;
const SPRING_DAMPING = 2 * SPRING_DAMPING_FRACTION * SPRING_ANGULAR_FREQUENCY;
const SPRING_REST_DISPLACEMENT_PX = 0.25;
const SPRING_REST_VELOCITY_PX_PER_S = 40;

// Promotes a pane to its own GPU-composited layer up front, before any
// gesture starts. Without this, mobile Safari tends to defer layer creation
// until the first transform write and then repaint the pane's contents
// (event blocks, text) on the frames around that promotion — visible as a
// brief flicker right as a swipe begins.
const PANE_LAYER_STYLE: CSSProperties = {
  willChange: "transform",
  backfaceVisibility: "hidden",
};

/** Damped mass-spring integrated with semi-implicit Euler, ticked on rAF.
 *  Returns a cancel function. Velocity is continuous across calls (callers
 *  pass the real release velocity), which is what makes a re-grabbed or
 *  flicked pane keep moving the way it was already moving instead of
 *  snapping through a dead zero-velocity start. */
function animateSpring(opts: {
  from: number;
  velocity: number; // px/s
  to: number;
  onUpdate: (pos: number) => void;
  onComplete: () => void;
}): () => void {
  let pos = opts.from;
  let vel = opts.velocity;
  let lastT: number | null = null;
  let rafId = 0;

  const tick = (t: number) => {
    if (lastT === null) lastT = t;
    const dt = Math.min((t - lastT) / 1000, 1 / 30);
    lastT = t;

    const displacement = pos - opts.to;
    const accel = -SPRING_STIFFNESS * displacement - SPRING_DAMPING * vel;
    vel += accel * dt;
    pos += vel * dt;

    const settled =
      Math.abs(pos - opts.to) < SPRING_REST_DISPLACEMENT_PX && Math.abs(vel) < SPRING_REST_VELOCITY_PX_PER_S;
    if (settled) {
      opts.onUpdate(opts.to);
      opts.onComplete();
      return;
    }
    opts.onUpdate(pos);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

function computeVelocityPxPerMs(samples: { x: number; t: number }[], endX: number, endT: number): number {
  let first = samples[0];
  for (const s of samples) {
    if (endT - s.t <= VELOCITY_SAMPLE_WINDOW_MS) {
      first = s;
      break;
    }
  }
  if (!first) return 0;
  const dt = endT - first.t;
  if (dt <= 0) return 0;
  return (endX - first.x) / dt;
}

/** Whether a release should commit to the neighbor day: a decisive flick in
 *  the drag's direction commits (or cancels, if flicked back) regardless of
 *  distance traveled; otherwise it falls back to the halfway point. */
function decideCommit(offsetPx: number, direction: 1 | -1, velocityPxPerMs: number, width: number): boolean {
  if (width <= 0) return false;
  const progress = direction === 1 ? -offsetPx / width : offsetPx / width;
  const velocityTowardCommit = direction === 1 ? -velocityPxPerMs : velocityPxPerMs;
  if (velocityTowardCommit <= -SWIPE_COMMIT_VELOCITY_PX_PER_MS) return false;
  if (velocityTowardCommit >= SWIPE_COMMIT_VELOCITY_PX_PER_MS) return true;
  return progress > SWIPE_COMMIT_DISTANCE_RATIO;
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
  const phaseRef = useRef<SwipePhase>("idle");
  const pendingCommitRef = useRef(false);
  const offsetRef = useRef(0);
  const basePaneRef = useRef<HTMLDivElement>(null);
  const neighborPaneRef = useRef<HTMLDivElement>(null);
  const springCancelRef = useRef<(() => void) | null>(null);
  const dragRef = useRef<DragTrackState | null>(null);

  // The mini week strip's selected-day indicator shouldn't wait for
  // onSelectDate (which only fires once the settle animation finishes) —
  // real scroll views flip a page indicator the instant the content crosses
  // the halfway point, live during a drag and mid-flight during a
  // programmatic settle alike. crossedMidpointRef mirrors the state
  // without forcing a re-render on every frame; the state only changes
  // (and re-renders) on the crossing itself.
  const crossedMidpointRef = useRef(false);
  const [swipeCrossedMidpoint, setSwipeCrossedMidpoint] = useState(false);

  useEffect(() => {
    return () => springCancelRef.current?.();
  }, []);

  function applyOffset(offsetPx: number, direction: 1 | -1, width: number) {
    offsetRef.current = offsetPx;
    // translate3d (not translateX) keeps each pane on its own GPU-composited
    // layer for the whole gesture. With a plain 2D translateX, mobile Safari
    // will repaint the pane's contents (event blocks, text) on some frames
    // instead of just recompositing the existing layer, which reads as a
    // flicker on the events sliding underneath.
    if (basePaneRef.current) basePaneRef.current.style.transform = `translate3d(${offsetPx}px, 0, 0)`;
    if (neighborPaneRef.current) {
      neighborPaneRef.current.style.transform = `translate3d(${offsetPx + direction * width}px, 0, 0)`;
    }

    if (width > 0) {
      const progress = direction === 1 ? -offsetPx / width : offsetPx / width;
      const crossed = progress > 0.5;
      if (crossed !== crossedMidpointRef.current) {
        crossedMidpointRef.current = crossed;
        setSwipeCrossedMidpoint(crossed);
      }
    }
  }

  function startSettle(target: number, initialVelocityPxPerSec: number, commit: boolean, direction: 1 | -1) {
    springCancelRef.current?.();
    phaseRef.current = "settling";
    pendingCommitRef.current = commit;
    const w = getContainerWidth();
    const neighborDate = swipe?.neighborDate ?? null;
    springCancelRef.current = animateSpring({
      from: offsetRef.current,
      velocity: initialVelocityPxPerSec,
      to: target,
      onUpdate: (pos) => applyOffset(pos, direction, w),
      onComplete: () => {
        springCancelRef.current = null;
        phaseRef.current = "idle";
        // Don't reset the base pane's transform here: the spring's last
        // onUpdate already left both panes in the correct final position
        // (base off-screen, neighbor at 0 for a commit). Resetting the base
        // pane to 0 right now — before React has swapped its content to the
        // new selectedDate — would briefly bring the *old* date back into
        // view on top of the correct neighbor pane, flickering for a frame.
        // The reset below is deferred to a layout effect keyed on `swipe`
        // going back to null, so it lands in the same paint as the base
        // pane's content actually becoming the new date.
        setSwipe(null);
        if (pendingCommitRef.current && neighborDate) onSelectDate(neighborDate);
      },
    });
  }

  // Programmatic jump (mini strip tap, Today button): arm a slide toward
  // `date` in a single motion, whatever the distance, rather than updating
  // selectedDate directly (which would just snap with no transition, or —
  // if callers stepped through it themselves — hop day by day).
  function navigateTo(date: Date) {
    const target = startOfDay(date);
    if (transition || swipe) return;
    if (isSameDay(target, selectedDate)) return;
    const direction: 1 | -1 = target.getTime() > selectedDate.getTime() ? 1 : -1;
    phaseRef.current = "pending";
    applyOffset(0, direction, getContainerWidth());
    setSwipe({ neighborDate: target, direction });
  }

  // The neighbor pane's transform is set imperatively (never read from a ref
  // during render — refs aren't render inputs), so its first frame needs to
  // be placed as soon as it mounts, before the browser paints.
  useLayoutEffect(() => {
    if (!swipe || !neighborPaneRef.current) return;
    const w = getContainerWidth();
    neighborPaneRef.current.style.transform = `translate3d(${offsetRef.current + swipe.direction * w}px, 0, 0)`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipe]);

  // Once a swipe ends (commit or cancel), the base pane's DOM transform is
  // never touched again — nothing else drives it. For a cancel it's already
  // sitting at 0 (the spring settled there). For a commit it's sitting
  // off-screen, and by this point `selectedDate` has updated to match, so
  // the base pane's content is already the (former) neighbor's — reset its
  // transform to 0 now, in the same layout-effect pass as that content
  // change, so the pane lands on-screen without an intervening paint.
  useLayoutEffect(() => {
    if (swipe) return;
    offsetRef.current = 0;
    if (basePaneRef.current) basePaneRef.current.style.transform = "translate3d(0px, 0, 0)";
  }, [swipe]);

  // Arms the programmatic jump a frame after mount so the browser observes
  // the neighbor pane's off-screen starting frame before animating it in.
  useLayoutEffect(() => {
    if (!swipe || phaseRef.current !== "pending") return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (phaseRef.current !== "pending") return;
        startSettle(-swipe.direction * getContainerWidth(), 0, true, swipe.direction);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipe]);

  function handlePointerDown(e: ReactPointerEvent) {
    if (transition) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // A real scroll view can be grabbed mid-deceleration: stop the spring
    // exactly where it is and resume 1:1 finger tracking from there, instead
    // of ignoring the touch until the settle finishes.
    if (swipe && phaseRef.current === "settling") {
      springCancelRef.current?.();
      springCancelRef.current = null;
      phaseRef.current = "drag";
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        locked: "x",
        direction: swipe.direction,
        // Continue from wherever the spring was interrupted, not from 0 —
        // that's what makes the re-grab feel continuous instead of snapping.
        baseOffsetPx: offsetRef.current,
        samples: [{ x: e.clientX, t: e.timeStamp }],
      };
      return;
    }
    if (swipe) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      locked: null,
      direction: null,
      baseOffsetPx: 0,
      samples: [],
    };
  }

  function handlePointerMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (d.locked === null) {
      if (Math.abs(dx) < SWIPE_LOCK_THRESHOLD_PX && Math.abs(dy) < SWIPE_LOCK_THRESHOLD_PX) return;
      d.locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.locked !== "x") return;
      d.direction = dx < 0 ? 1 : -1;
      phaseRef.current = "drag";
      applyOffset(0, d.direction, getContainerWidth());
      d.samples = [{ x: e.clientX, t: e.timeStamp }];
      setSwipe({ neighborDate: addDays(selectedDate, d.direction), direction: d.direction });
    }
    if (d.locked !== "x" || d.direction === null) return;

    d.samples.push({ x: e.clientX, t: e.timeStamp });
    if (d.samples.length > 6) d.samples.shift();

    const w = getContainerWidth();
    // Clamp to the locked direction's half of the range: dragging back past
    // the resting position would otherwise slide the base pane the "wrong"
    // way with nothing mounted behind it.
    const [lo, hi] = d.direction === 1 ? [-w, 0] : [0, w];
    const nextOffset = Math.max(lo, Math.min(hi, d.baseOffsetPx + dx));
    applyOffset(nextOffset, d.direction, w);
  }

  function handlePointerUp(e: ReactPointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.pointerId !== e.pointerId || d.locked !== "x" || d.direction === null) return;
    const w = getContainerWidth();
    const velocityPxPerMs = computeVelocityPxPerMs(d.samples, e.clientX, e.timeStamp);
    const commit = decideCommit(offsetRef.current, d.direction, velocityPxPerMs, w);
    const target = commit ? -d.direction * w : 0;
    startSettle(target, velocityPxPerMs * 1000, commit, d.direction);
  }

  function handlePointerCancel(e: ReactPointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.pointerId !== e.pointerId || d.locked !== "x" || d.direction === null) return;
    startSettle(0, 0, false, d.direction);
  }

  const miniStripDate = swipe && swipeCrossedMidpoint ? swipe.neighborDate : selectedDate;

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
        <div ref={basePaneRef} className="absolute inset-0" style={PANE_LAYER_STYLE}>
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
          <div ref={neighborPaneRef} className="absolute inset-0" style={PANE_LAYER_STYLE}>
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
            selectedDate={miniStripDate}
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
