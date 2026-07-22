"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CalendarEvent, CalendarSource } from "@/lib/types";
import {
  HOUR_HEIGHT_PX,
  LONG_PRESS_MS,
  LONG_PRESS_MOVE_TOLERANCE_PX,
  MINUTES_IN_DAY,
  MIN_EVENT_DURATION_MIN,
  clamp,
  minutesToLocalIso,
  minutesToPx,
  pxToMinutes,
  snapMinutes,
} from "@/lib/day-grid";
import { formatHourParts, minutesSinceMidnight } from "@/lib/date-utils";
import { layoutOverlappingEvents, SOLO_LAYOUT } from "@/lib/event-layout";
import { EventBlock, type ResizeEdge } from "./EventBlock";
import { CurrentTimeLine } from "./CurrentTimeLine";

interface HourGridProps {
  events: CalendarEvent[];
  calendarsById: Map<string, CalendarSource>;
  isToday: boolean;
  onSelectEvent?: (event: CalendarEvent) => void;
  /** Persist a move/resize back to the event's start/end (local-naive ISO). */
  onUpdateEventTimes?: (id: string, startIso: string, endIso: string) => void;
}

const GUTTER_WIDTH_PX = 52;

/** Which edge of the block a drag is currently moving. */
type DragKind = "pending" | "scroll" | "move" | "resize-start" | "resize-end";

interface Gesture {
  kind: DragKind;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  /** Start/end (minutes since midnight) at the instant the drag began. */
  origStartMin: number;
  origEndMin: number;
  /** Live start/end tracked every move, so pointer-up can commit without
   *  waiting for the async state read. */
  curStartMin: number;
  curEndMin: number;
  eventId: string;
  moved: boolean;
}

interface EditState {
  id: string;
  /** Live (dragged) position. */
  startMin: number;
  endMin: number;
  /** Where the event currently rests — the ghost's position during a drag. */
  committedStartMin: number;
  committedEndMin: number;
  /** True only while a finger is actively moving/resizing the block. */
  dragging: boolean;
}

export function HourGrid({
  events,
  calendarsById,
  isToday,
  onSelectEvent,
  onUpdateEventTimes,
}: HourGridProps) {
  const layout = layoutOverlappingEvents(
    events.map((e) => ({ id: e.id, start: new Date(e.start), end: new Date(e.end) })),
  );
  const layoutById = new Map(layout.map((l) => [l.id, l]));

  const rootRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  const eventById = (id: string) => events.find((e) => e.id === id);

  function clearLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function releaseCapture(pointerId: number) {
    try {
      rootRef.current?.releasePointerCapture(pointerId);
    } catch {
      /* not captured — ignore */
    }
  }

  // Cancel a pending edit if this component unmounts (e.g. day swipe) mid-hold.
  useEffect(() => () => clearLongPress(), []);

  function enterEditFromLongPress(g: Gesture) {
    if (!eventById(g.eventId)) return;
    g.kind = "move";
    g.moved = false;
    rootRef.current?.setPointerCapture(g.pointerId);
    setEditing({
      id: g.eventId,
      startMin: g.origStartMin,
      endMin: g.origEndMin,
      committedStartMin: g.origStartMin,
      committedEndMin: g.origEndMin,
      dragging: true,
    });
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  }

  function handleEventPointerDown(event: CalendarEvent, e: ReactPointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const alreadyEditingThis = editing?.id === event.id;
    const origStartMin = alreadyEditingThis
      ? editing!.startMin
      : minutesSinceMidnight(new Date(event.start));
    const origEndMin = alreadyEditingThis
      ? editing!.endMin
      : minutesSinceMidnight(new Date(event.end));

    const g: Gesture = {
      kind: "pending",
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origStartMin,
      origEndMin,
      curStartMin: origStartMin,
      curEndMin: origEndMin,
      eventId: event.id,
      moved: false,
    };
    gestureRef.current = g;

    if (alreadyEditingThis) {
      // Already in edit mode: the body is a move handle immediately, no hold.
      g.kind = "move";
      rootRef.current?.setPointerCapture(e.pointerId);
      setEditing((prev) =>
        prev ? { ...prev, dragging: true, committedStartMin: prev.startMin, committedEndMin: prev.endMin } : prev,
      );
      return;
    }

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      const cur = gestureRef.current;
      if (cur && cur === g && cur.kind === "pending") enterEditFromLongPress(cur);
    }, LONG_PRESS_MS);
  }

  function handleResizeHandleDown(edge: ResizeEdge, e: ReactPointerEvent) {
    if (!editing) return;
    const g: Gesture = {
      kind: edge === "start" ? "resize-start" : "resize-end",
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origStartMin: editing.startMin,
      origEndMin: editing.endMin,
      curStartMin: editing.startMin,
      curEndMin: editing.endMin,
      eventId: editing.id,
      moved: false,
    };
    gestureRef.current = g;
    rootRef.current?.setPointerCapture(e.pointerId);
    setEditing((prev) =>
      prev ? { ...prev, dragging: true, committedStartMin: prev.startMin, committedEndMin: prev.endMin } : prev,
    );
  }

  function applyDrag(g: Gesture, deltaMin: number) {
    const duration = g.origEndMin - g.origStartMin;
    let startMin = g.origStartMin;
    let endMin = g.origEndMin;
    if (g.kind === "move") {
      startMin = clamp(g.origStartMin + deltaMin, 0, MINUTES_IN_DAY - duration);
      endMin = startMin + duration;
    } else if (g.kind === "resize-start") {
      startMin = clamp(g.origStartMin + deltaMin, 0, g.origEndMin - MIN_EVENT_DURATION_MIN);
      endMin = g.origEndMin;
    } else if (g.kind === "resize-end") {
      startMin = g.origStartMin;
      endMin = clamp(g.origEndMin + deltaMin, g.origStartMin + MIN_EVENT_DURATION_MIN, MINUTES_IN_DAY);
    }
    g.curStartMin = startMin;
    g.curEndMin = endMin;
    setEditing((prev) => (prev ? { ...prev, startMin, endMin, dragging: true } : prev));
  }

  function handleRootPointerMove(e: ReactPointerEvent) {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.startClientX;
    const dy = e.clientY - g.startClientY;

    if (g.kind === "pending") {
      // Movement before the hold completes means this was a scroll/swipe, not
      // an edit — abandon the edit intent and let the ancestors handle it.
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) {
        clearLongPress();
        g.kind = "scroll";
      }
      return;
    }
    if (g.kind === "scroll") return;

    // Active edit drag: keep it away from the day-swipe / scroll ancestors.
    e.stopPropagation();
    g.moved = true;
    applyDrag(g, snapMinutes(pxToMinutes(dy)));
  }

  function handleRootPointerUp(e: ReactPointerEvent) {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    clearLongPress();
    releaseCapture(e.pointerId);
    gestureRef.current = null;

    if (g.kind === "pending") {
      // A clean press-release with no hold and no movement is a tap.
      if (!g.moved && !editing) {
        const ev = eventById(g.eventId);
        if (ev) onSelectEvent?.(ev);
      }
      return;
    }
    if (g.kind === "scroll") return;

    e.stopPropagation();
    setEditing((prev) =>
      prev
        ? { ...prev, dragging: false, committedStartMin: g.curStartMin, committedEndMin: g.curEndMin }
        : prev,
    );

    const ev = eventById(g.eventId);
    if (ev && (g.curStartMin !== g.origStartMin || g.curEndMin !== g.origEndMin)) {
      const base = new Date(ev.start);
      onUpdateEventTimes?.(
        ev.id,
        minutesToLocalIso(base, g.curStartMin),
        minutesToLocalIso(base, g.curEndMin),
      );
    }
  }

  function handleRootPointerCancel(e: ReactPointerEvent) {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    clearLongPress();
    releaseCapture(e.pointerId);
    gestureRef.current = null;
    // Snap the picked-up copy back to where it rested; don't write anything.
    setEditing((prev) =>
      prev ? { ...prev, startMin: prev.committedStartMin, endMin: prev.committedEndMin, dragging: false } : prev,
    );
  }

  function exitEdit() {
    if (gestureRef.current) return; // don't drop out mid-drag
    setEditing(null);
  }

  const editingEvent = editing ? eventById(editing.id) : null;
  const editingLayout = editing ? (layoutById.get(editing.id) ?? SOLO_LAYOUT) : SOLO_LAYOUT;
  const editingColor = editingEvent ? (calendarsById.get(editingEvent.calendarId)?.color ?? "gray") : "gray";
  const editBaseDate = editingEvent ? new Date(editingEvent.start) : null;

  // Quarter-hour gutter ticks, revealed only during an active drag, around the
  // hours the moving edges currently sit in (matching the reference).
  const subHourTicks =
    editing && editing.dragging
      ? Array.from(new Set([Math.floor(editing.startMin / 60), Math.floor(editing.endMin / 60)]))
          .filter((h) => h >= 0 && h < 24)
          .flatMap((h) =>
            [15, 30, 45]
              .map((m) => h * 60 + m)
              .filter((min) => min < MINUTES_IN_DAY)
              .map((min) => ({ min, label: `:${min % 60}` })),
          )
      : [];

  return (
    <div
      ref={rootRef}
      className="relative"
      style={{ height: HOUR_HEIGHT_PX * 24, touchAction: editing ? "none" : undefined }}
      onPointerMove={handleRootPointerMove}
      onPointerUp={handleRootPointerUp}
      onPointerCancel={handleRootPointerCancel}
    >
      {Array.from({ length: 24 }, (_, hour) => {
        const { value, period } = formatHourParts(hour);
        return (
          <div
            key={hour}
            className="absolute inset-x-0 border-t border-black/[.07] ml-12 dark:border-white/[.1]"
            style={{ top: hour * HOUR_HEIGHT_PX }}
          >
            <span
              className="absolute -translate-y-1/2 -translate-x-14 text-right text-[11px] text-black/40 dark:text-white/40"
              style={{ left: 4, width: GUTTER_WIDTH_PX - 10 }}
            >
              <span className="font-medium text-black/60 dark:text-white/60 text-[12px]">{value}</span>
              {period && <span className="ml-0.5 text-[9px]">{period}</span>}
            </span>
          </div>
        );
      })}

      {/* Sub-hour (:15/:30/:45) markers — only while dragging/resizing. */}
      {subHourTicks.map(({ min, label }) => (
        <span
          key={min}
          className="pointer-events-none absolute z-[25] -translate-y-1/2 text-right text-[10px] font-medium text-black/35 dark:text-white/40"
          style={{ top: minutesToPx(min), left: 4, width: GUTTER_WIDTH_PX - 10 }}
        >
          {label}
        </span>
      ))}

      {/* Tap-away layer that leaves edit mode; also masks non-editing events
          from interaction while a block is being edited. */}
      {editing && (
        <div
          className="absolute inset-0 z-10"
          onPointerDown={exitEdit}
          style={{ touchAction: "none" }}
        />
      )}

      <div className="absolute inset-y-0" style={{ left: GUTTER_WIDTH_PX, right: 8 }}>
        {events.map((event) => {
          if (editing?.id === event.id) return null; // replaced by ghost + picked-up copy
          const l = layoutById.get(event.id);
          const calendar = calendarsById.get(event.calendarId);
          return (
            <EventBlock
              key={event.id}
              event={event}
              colorName={calendar?.color ?? "gray"}
              leftPct={l?.leftPct ?? SOLO_LAYOUT.leftPct}
              widthPct={l?.widthPct ?? SOLO_LAYOUT.widthPct}
              nested={l?.nested ?? false}
              onPointerDown={(e) => handleEventPointerDown(event, e)}
            />
          );
        })}

        {editing && editingEvent && editBaseDate && (
          <>
            {editing.dragging &&
              (editing.committedStartMin !== editing.startMin ||
                editing.committedEndMin !== editing.endMin) && (
                <EventBlock
                  event={{
                    ...editingEvent,
                    start: minutesToLocalIso(editBaseDate, editing.committedStartMin),
                    end: minutesToLocalIso(editBaseDate, editing.committedEndMin),
                  }}
                  colorName={editingColor}
                  leftPct={editingLayout.leftPct}
                  widthPct={editingLayout.widthPct}
                  ghost
                  zIndexOverride={20}
                />
              )}

            <EventBlock
              event={{
                ...editingEvent,
                start: minutesToLocalIso(editBaseDate, editing.startMin),
                end: minutesToLocalIso(editBaseDate, editing.endMin),
              }}
              colorName={editingColor}
              leftPct={editingLayout.leftPct}
              widthPct={editingLayout.widthPct}
              variant="solid"
              editing
              onPointerDown={(e) => handleEventPointerDown(editingEvent, e)}
              onResizeHandleDown={handleResizeHandleDown}
            />
          </>
        )}
      </div>

      {isToday && <CurrentTimeLine />}
    </div>
  );
}
