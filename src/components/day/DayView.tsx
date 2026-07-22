"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { CalendarColorName, CalendarEvent, CalendarSource, Reminder } from "@/lib/types";
import { MONTH_NAMES, addDays, isSameDay, startOfDay } from "@/lib/date-utils";
import {
  EVENT_EDGE_GAP_PX,
  MINUTES_IN_DAY,
  MIN_EVENT_DURATION_MIN,
  MIN_EVENT_HEIGHT_PX,
  clamp,
  minutesToLocalIso,
  minutesToPx,
  pxToMinutes,
  snapMinutes,
} from "@/lib/day-grid";
import { TopNavBar } from "@/components/shared/TopNavBar";
import { BottomBar } from "@/components/shared/BottomBar";
import { TRANSITION_MS, TRANSITION_EASE } from "@/lib/transition-constants";
import { MiniWeekStrip } from "./MiniWeekStrip";
import { DayContentPane } from "./DayContentPane";
import { EventBlockBody, type ResizeEdge } from "./EventBlock";
import type { EventLongPressInfo } from "./HourGrid";

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
  onUpdateEventTimes?: (id: string, startIso: string, endIso: string) => void;
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
const SWIPE_COMMIT_DISTANCE_RATIO = 0.35;
// ...or on any decisive flick, regardless of how far it's traveled yet — a
// quick 20px flick should turn the page just as a slow 300px drag does.
const SWIPE_COMMIT_VELOCITY_PX_PER_MS = 0.28;
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

/**
 * On-grid move/resize edit, owned here (above the swipeable panes) rather than
 * inside a single day's HourGrid, so a held event survives day-to-day swiping:
 * the picked-up copy is a pinned overlay that stays put while the day grid
 * slides beneath it (drag with one finger, swipe days with another). The ghost
 * stays in whichever pane still shows the event's source day.
 */
interface EditSession {
  event: CalendarEvent;
  colorName: CalendarColorName;
  /** The day the event currently belongs to (its ghost's day). */
  sourceDate: Date;
  /** Reference time the anchor rect maps to. */
  origStartMin: number;
  origEndMin: number;
  /** Live dragged time. */
  startMin: number;
  endMin: number;
  dragging: boolean;
  /** Viewport rect of the block at pickup: anchorTop corresponds to origStartMin. */
  anchorTop: number;
  anchorLeft: number;
  anchorWidth: number;
}

interface EditGesture {
  kind: "move" | "resize-start" | "resize-end";
  startClientY: number;
  origStartMin: number;
  origEndMin: number;
  curStartMin: number;
  curEndMin: number;
}

function overlayTopPx(edit: EditSession): number {
  return edit.anchorTop + minutesToPx(edit.startMin - edit.origStartMin);
}

function overlayHeightPx(edit: EditSession): number {
  return Math.max(MIN_EVENT_HEIGHT_PX, minutesToPx(edit.endMin - edit.startMin)) - EVENT_EDGE_GAP_PX * 2;
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
  onUpdateEventTimes,
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

  // ---- On-grid edit (move/resize), owned above the panes for cross-day drag ----
  const [edit, setEdit] = useState<EditSession | null>(null);
  const editPointerRef = useRef<number | null>(null);
  const editGestureRef = useRef<EditGesture | null>(null);

  // The browser latches a touch's scroll intent at touchstart from the
  // then-current touch-action (pan-y). By the time the long-press fires and we
  // set touch-action:none, that decision is already made, so the pane would
  // keep native-scrolling under the pinned copy — dragging the event the wrong
  // way. A non-passive touchmove listener cancels that in-progress scroll while
  // an edit drag is live (the long-press only fires with a still finger, so no
  // scroll has started yet at that point). React's own listeners are passive,
  // hence this manual one.
  useEffect(() => {
    const el = swipeContainerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (editPointerRef.current !== null) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  function captureEditPointer(pointerId: number) {
    try {
      swipeContainerRef.current?.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }
  function releaseEditPointer(pointerId: number) {
    try {
      swipeContainerRef.current?.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }

  function applyEditDrag(g: EditGesture, deltaMin: number) {
    const duration = g.origEndMin - g.origStartMin;
    let startMin = g.origStartMin;
    let endMin = g.origEndMin;
    if (g.kind === "move") {
      startMin = clamp(g.origStartMin + deltaMin, 0, MINUTES_IN_DAY - duration);
      endMin = startMin + duration;
    } else if (g.kind === "resize-start") {
      startMin = clamp(g.origStartMin + deltaMin, 0, g.origEndMin - MIN_EVENT_DURATION_MIN);
      endMin = g.origEndMin;
    } else {
      startMin = g.origStartMin;
      endMin = clamp(g.origEndMin + deltaMin, g.origStartMin + MIN_EVENT_DURATION_MIN, MINUTES_IN_DAY);
    }
    g.curStartMin = startMin;
    g.curEndMin = endMin;
    setEdit((prev) => (prev ? { ...prev, startMin, endMin, dragging: true } : prev));
  }

  // Long-press on an event (reported up from HourGrid) → pick it up.
  function handleEnterEdit(info: EventLongPressInfo) {
    if (transition) return;
    editPointerRef.current = info.pointerId;
    editGestureRef.current = {
      kind: "move",
      startClientY: info.clientY,
      origStartMin: info.origStartMin,
      origEndMin: info.origEndMin,
      curStartMin: info.origStartMin,
      curEndMin: info.origEndMin,
    };
    // The same finger's initial press may have armed a swipe drag — drop it.
    if (dragRef.current?.pointerId === info.pointerId) dragRef.current = null;
    captureEditPointer(info.pointerId);
    setEdit({
      event: info.event,
      colorName: info.colorName,
      sourceDate: startOfDay(new Date(info.event.start)),
      origStartMin: info.origStartMin,
      origEndMin: info.origEndMin,
      startMin: info.origStartMin,
      endMin: info.origEndMin,
      dragging: true,
      anchorTop: info.rect.top,
      anchorLeft: info.rect.left,
      anchorWidth: info.rect.width,
    });
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  }

  // Re-grab the resting picked-up copy to move it again (already in edit mode).
  function handleOverlayPointerDown(e: ReactPointerEvent) {
    if (!edit) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (editPointerRef.current !== null) return; // a finger is already dragging; let it bubble (swipe)
    e.stopPropagation();
    const top = overlayTopPx(edit);
    editGestureRef.current = {
      kind: "move",
      startClientY: e.clientY,
      origStartMin: edit.startMin,
      origEndMin: edit.endMin,
      curStartMin: edit.startMin,
      curEndMin: edit.endMin,
    };
    editPointerRef.current = e.pointerId;
    setEdit((prev) =>
      prev ? { ...prev, dragging: true, origStartMin: prev.startMin, origEndMin: prev.endMin, anchorTop: top } : prev,
    );
    captureEditPointer(e.pointerId);
  }

  function handleResizeHandleDown(edge: ResizeEdge, e: ReactPointerEvent) {
    if (!edit) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (editPointerRef.current !== null) return;
    e.stopPropagation();
    const top = overlayTopPx(edit);
    editGestureRef.current = {
      kind: edge === "start" ? "resize-start" : "resize-end",
      startClientY: e.clientY,
      origStartMin: edit.startMin,
      origEndMin: edit.endMin,
      curStartMin: edit.startMin,
      curEndMin: edit.endMin,
    };
    editPointerRef.current = e.pointerId;
    setEdit((prev) =>
      prev ? { ...prev, dragging: true, origStartMin: prev.startMin, origEndMin: prev.endMin, anchorTop: top } : prev,
    );
    captureEditPointer(e.pointerId);
  }

  function handleEditMove(e: ReactPointerEvent) {
    const g = editGestureRef.current;
    if (!g) return;
    applyEditDrag(g, snapMinutes(pxToMinutes(e.clientY - g.startClientY)));
  }

  function commitEdit(e: ReactPointerEvent) {
    const g = editGestureRef.current;
    editGestureRef.current = null;
    editPointerRef.current = null;
    releaseEditPointer(e.pointerId);
    if (!g || !edit) return;
    const { curStartMin: startMin, curEndMin: endMin } = g;
    // Drop onto whatever day is showing now (a finger-B swipe may have changed it).
    const targetDate = selectedDate;
    setEdit((prev) =>
      prev
        ? {
            ...prev,
            dragging: false,
            sourceDate: targetDate,
            origStartMin: startMin,
            origEndMin: endMin,
            startMin,
            endMin,
            anchorTop: overlayTopPx(prev),
          }
        : prev,
    );
    const startIso = minutesToLocalIso(targetDate, startMin);
    const endIso = minutesToLocalIso(targetDate, endMin);
    const current = events.find((ev) => ev.id === edit.event.id);
    if (!current || current.start !== startIso || current.end !== endIso) {
      onUpdateEventTimes?.(edit.event.id, startIso, endIso);
    }
  }

  function cancelEdit(e: ReactPointerEvent) {
    editGestureRef.current = null;
    editPointerRef.current = null;
    releaseEditPointer(e.pointerId);
    setEdit((prev) =>
      prev ? { ...prev, startMin: prev.origStartMin, endMin: prev.origEndMin, dragging: false } : prev,
    );
  }

  function exitEdit() {
    if (editGestureRef.current) return; // don't drop out mid-drag
    setEdit(null);
  }

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
    if (editPointerRef.current === e.pointerId) {
      handleEditMove(e);
      return;
    }
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
    if (editPointerRef.current === e.pointerId) {
      commitEdit(e);
      return;
    }
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
    if (editPointerRef.current === e.pointerId) {
      cancelEdit(e);
      return;
    }
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.pointerId !== e.pointerId || d.locked !== "x" || d.direction === null) return;
    startSettle(0, 0, false, d.direction);
  }

  const miniStripDate = swipe && swipeCrossedMidpoint ? swipe.neighborDate : selectedDate;

  // Which pane (if any) currently shows the edited event's source day — that
  // pane hides the event's normal block and renders the dimmed ghost.
  const baseIsSource = !!edit && isSameDay(selectedDate, edit.sourceDate);
  const baseEditingId = baseIsSource ? edit!.event.id : null;
  const baseGhost = baseIsSource && edit!.dragging ? { startMin: edit!.origStartMin, endMin: edit!.origEndMin } : null;
  const neighborDate = swipe?.neighborDate ?? null;
  const neighborIsSource = !!edit && !!neighborDate && isSameDay(neighborDate, edit.sourceDate);
  const neighborEditingId = neighborIsSource ? edit!.event.id : null;
  const neighborGhost = neighborIsSource && edit!.dragging ? { startMin: edit!.origStartMin, endMin: edit!.origEndMin } : null;

  // Quarter-hour gutter ticks, only during an active drag, around the hours the
  // moving edges sit in — pinned to the overlay's coordinate frame.
  const editTicks =
    edit && edit.dragging
      ? Array.from(new Set([Math.floor(edit.startMin / 60), Math.floor(edit.endMin / 60)]))
          .filter((h) => h >= 0 && h < 24)
          .flatMap((h) =>
            [15, 30, 45]
              .map((m) => h * 60 + m)
              .filter((min) => min < MINUTES_IN_DAY)
              .map((min) => ({ min, label: `:${min % 60}`, y: edit.anchorTop + minutesToPx(min - edit.origStartMin) })),
          )
      : [];

  const chromeIsOff = transition ? (transition.mode === "exit" ? transition.armed : !transition.armed) : false;
  const chromeStyle = transition
    ? { opacity: chromeIsOff ? 0 : 1, transition: `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}` }
    : undefined;

  return (
    <div className={`fixed inset-0 overflow-hidden ${transition ? "pointer-events-none" : ""}`}>
      <div
        ref={swipeContainerRef}
        data-day-swipe
        className={`pointer-events-auto absolute inset-0 ${edit ? "select-none" : ""}`}
        // During an edit, lock native scrolling so one finger retimes and a
        // second can still drive the JS day-swipe.
        style={{ touchAction: edit ? "none" : "pan-y" }}
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
            editingEventId={baseEditingId}
            ghost={baseGhost}
            onEventLongPress={handleEnterEdit}
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
              editingEventId={neighborEditingId}
              ghost={neighborGhost}
              onEventLongPress={handleEnterEdit}
              topOffset={headerHeight}
              verticalTransition={null}
            />
          </div>
        )}

        {edit && (
          <>
            {/* Tap-away layer (only at rest, so a second finger can swipe mid-drag). */}
            {!edit.dragging && (
              <div
                className="absolute inset-0 z-[15]"
                style={{ touchAction: "none" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  exitEdit();
                }}
              />
            )}

            {/* Quarter-hour gutter ticks, pinned to the overlay frame. */}
            {editTicks.map((t) => (
              <span
                key={t.min}
                className="pointer-events-none absolute z-[31] -translate-y-1/2 text-right text-[10px] font-medium text-black/40 dark:text-white/50"
                style={{ top: t.y, left: edit.anchorLeft - 46, width: 40 }}
              >
                {t.label}
              </span>
            ))}

            {/* The pinned picked-up copy: stays put while days slide underneath. */}
            <div
              className="absolute z-30"
              style={{
                top: overlayTopPx(edit),
                left: edit.anchorLeft,
                width: edit.anchorWidth,
                height: overlayHeightPx(edit),
                touchAction: "none",
                cursor: "grab",
              }}
              onPointerDown={handleOverlayPointerDown}
            >
              <EventBlockBody
                event={{
                  ...edit.event,
                  start: minutesToLocalIso(edit.sourceDate, edit.startMin),
                  end: minutesToLocalIso(edit.sourceDate, edit.endMin),
                }}
                colorName={edit.colorName}
                variant="solid"
                heightPx={overlayHeightPx(edit)}
                editing
                onResizeHandleDown={handleResizeHandleDown}
              />
            </div>
          </>
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
