"use client";

import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CalendarColorName, CalendarEvent, CalendarSource } from "@/lib/types";
import {
  LONG_PRESS_MS,
  LONG_PRESS_MOVE_TOLERANCE_PX,
  minutesToLocalIso,
} from "@/lib/day-grid";
import { formatHourParts, minutesSinceMidnight } from "@/lib/date-utils";
import { layoutOverlappingEvents, SOLO_LAYOUT } from "@/lib/event-layout";
import { useHourHeight } from "./DayScaleContext";
import { EventBlock } from "./EventBlock";
import { CurrentTimeLine } from "./CurrentTimeLine";

/** Reported when a press on an event is held long enough to become an on-grid
 *  edit — DayView takes over from here (it owns the drag + pinned copy). */
export interface EventLongPressInfo {
  event: CalendarEvent;
  colorName: CalendarColorName;
  /** The block's viewport rect at pickup — anchors the pinned overlay. */
  rect: { top: number; left: number; width: number; height: number };
  origStartMin: number;
  origEndMin: number;
  pointerId: number;
  /** Finger position at pickup — the reference frame for the drag delta. */
  clientY: number;
}

/** Ghost placeholder shown at the event's original time while it's dragged. */
export interface GhostSpec {
  startMin: number;
  endMin: number;
}

interface HourGridProps {
  events: CalendarEvent[];
  calendarsById: Map<string, CalendarSource>;
  isToday: boolean;
  onSelectEvent?: (event: CalendarEvent) => void;
  /** Event currently being edited — its normal block is hidden on this day. */
  editingEventId?: string | null;
  /** When set, render a dimmed ghost of the editing event at this time. */
  ghost?: GhostSpec | null;
  onEventLongPress?: (info: EventLongPressInfo) => void;
}

const GUTTER_WIDTH_PX = 52;

interface PendingPress {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  rect: { top: number; left: number; width: number; height: number };
  event: CalendarEvent;
  colorName: CalendarColorName;
  origStartMin: number;
  origEndMin: number;
  moved: boolean;
  firedEdit: boolean;
}

export function HourGrid({
  events,
  calendarsById,
  isToday,
  onSelectEvent,
  editingEventId = null,
  ghost = null,
  onEventLongPress,
}: HourGridProps) {
  const hourHeight = useHourHeight();
  const layout = layoutOverlappingEvents(
    events.map((e) => ({ id: e.id, start: new Date(e.start), end: new Date(e.end) })),
  );
  const layoutById = new Map(layout.map((l) => [l.id, l]));

  const pendingRef = useRef<PendingPress | null>(null);
  const timerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => () => clearTimer(), []);

  function handleEventPointerDown(event: CalendarEvent, colorName: CalendarColorName, e: ReactPointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p: PendingPress = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      event,
      colorName,
      origStartMin: minutesSinceMidnight(new Date(event.start)),
      origEndMin: minutesSinceMidnight(new Date(event.end)),
      moved: false,
      firedEdit: false,
    };
    pendingRef.current = p;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const cur = pendingRef.current;
      if (!cur || cur !== p || cur.moved || cur.firedEdit) return;
      cur.firedEdit = true;
      onEventLongPress?.({
        event: cur.event,
        colorName: cur.colorName,
        rect: cur.rect,
        origStartMin: cur.origStartMin,
        origEndMin: cur.origEndMin,
        pointerId: cur.pointerId,
        clientY: cur.startClientY,
      });
    }, LONG_PRESS_MS);
  }

  function handleRootPointerMove(e: ReactPointerEvent) {
    const p = pendingRef.current;
    if (!p || p.pointerId !== e.pointerId || p.firedEdit) return;
    const dx = e.clientX - p.startClientX;
    const dy = e.clientY - p.startClientY;
    // Any real movement before the hold completes means this is a scroll or a
    // day-swipe, not an edit — drop the press and let the ancestors take it.
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) {
      p.moved = true;
      clearTimer();
    }
  }

  function handleRootPointerUp(e: ReactPointerEvent) {
    const p = pendingRef.current;
    pendingRef.current = null;
    clearTimer();
    if (!p || p.pointerId !== e.pointerId) return;
    // Clean press-release with no hold and no movement is a tap → open the sheet.
    if (!p.firedEdit && !p.moved) onSelectEvent?.(p.event);
  }

  const editingEvent = editingEventId ? events.find((e) => e.id === editingEventId) : null;
  const editingLayout = editingEvent ? (layoutById.get(editingEvent.id) ?? SOLO_LAYOUT) : SOLO_LAYOUT;
  const editingColor = editingEvent
    ? (calendarsById.get(editingEvent.calendarId)?.color ?? "gray")
    : "gray";
  const ghostBase = editingEvent ? new Date(editingEvent.start) : null;

  return (
    <div
      className="relative"
      style={{ height: hourHeight * 24 }}
      onPointerMove={handleRootPointerMove}
      onPointerUp={handleRootPointerUp}
    >
      {Array.from({ length: 24 }, (_, hour) => {
        const { value, period } = formatHourParts(hour);
        return (
          <div
            key={hour}
            className="absolute inset-x-0 border-t border-black/[.07] ml-12 dark:border-white/[.1]"
            style={{ top: hour * hourHeight }}
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

      <div className="absolute inset-y-0" style={{ left: GUTTER_WIDTH_PX, right: 8 }}>
        {events.map((event) => {
          if (event.id === editingEventId) return null; // shown as ghost + pinned copy
          const l = layoutById.get(event.id);
          const calendar = calendarsById.get(event.calendarId);
          const colorName = calendar?.color ?? "gray";
          return (
            <EventBlock
              key={event.id}
              event={event}
              colorName={colorName}
              leftPct={l?.leftPct ?? SOLO_LAYOUT.leftPct}
              widthPct={l?.widthPct ?? SOLO_LAYOUT.widthPct}
              nested={l?.nested ?? false}
              onPointerDown={(e) => handleEventPointerDown(event, colorName, e)}
            />
          );
        })}

        {editingEvent && ghost && ghostBase && (
          <EventBlock
            event={{
              ...editingEvent,
              start: minutesToLocalIso(ghostBase, ghost.startMin),
              end: minutesToLocalIso(ghostBase, ghost.endMin),
            }}
            colorName={editingColor}
            leftPct={editingLayout.leftPct}
            widthPct={editingLayout.widthPct}
            ghost
            zIndexOverride={2}
          />
        )}
      </div>

      {isToday && <CurrentTimeLine />}
    </div>
  );
}
