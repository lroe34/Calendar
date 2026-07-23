"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { CalendarEvent } from "@/lib/types";
import { CALENDAR_COLORS, hexToRgba } from "@/lib/colors";
import {
  DETAIL_DISCLOSURE_THRESHOLD_PX,
  EVENT_EDGE_GAP_PX,
  MIN_EVENT_HEIGHT_PX,
  type EventDaySegment,
} from "@/lib/day-grid";
import { formatEventTimeRange, minutesSinceMidnight } from "@/lib/date-utils";
import { useDayScale } from "./DayScaleContext";
import { ClockIcon, PinIcon, RepeatIcon } from "@/components/shared/Icons";

export type ResizeEdge = "start" | "end";

interface EventBlockProps {
  event: CalendarEvent;
  colorName: keyof typeof CALENDAR_COLORS;
  /** The event's clipped slice on the day being rendered. When set, the block
   *  is positioned by the segment's bounds (so a multi-day event fills only
   *  its portion of each day) rather than the event's raw start/end. */
  segment?: EventDaySegment;
  leftPct: number;
  widthPct: number;
  /** True when this event is inset over a container event it's fully
   * contained within, rather than sharing a plain side-by-side column. */
  nested?: boolean;
  /** "tint" (default) is the normal Day-view look; "solid" is the inverted
   * saturated-fill/white-text style used by the detail sheet's mini preview
   * and the picked-up copy during an on-grid edit. */
  variant?: "tint" | "solid";
  /** Dimmed, non-interactive placeholder showing where the event still rests
   * while a copy of it is being dragged (see the on-grid edit interaction). */
  ghost?: boolean;
  /** Explicit stacking order (used to sit the ghost above the exit-edit backdrop). */
  zIndexOverride?: number;
  onClick?: () => void;
  onPointerDown?: (e: ReactPointerEvent) => void;
}

/** Absolutely-positioned block on the Day hour grid, placed by its start/end
 *  time and column slot. The picked-up copy during an on-grid edit reuses
 *  {@link EventBlockBody} directly instead, positioned as a pinned overlay. */
export function EventBlock({
  event,
  colorName,
  segment,
  leftPct,
  widthPct,
  nested = false,
  variant = "tint",
  ghost = false,
  zIndexOverride,
  onClick,
  onPointerDown,
}: EventBlockProps) {
  const { minutesToPx } = useDayScale();
  const start = new Date(event.start);
  const end = new Date(event.end);
  const startMin = segment ? segment.startMin : minutesSinceMidnight(start);
  const endMin = segment ? segment.endMin : minutesSinceMidnight(end);
  const continuesBefore = segment?.continuesBefore ?? false;
  const continuesAfter = segment?.continuesAfter ?? false;

  // A continued edge runs flush to the day boundary (no inset gap) so the bar
  // reads as one piece across midnight; a real edge keeps the usual gap that
  // separates back-to-back blocks.
  const topGap = continuesBefore ? 0 : EVENT_EDGE_GAP_PX;
  const bottomGap = continuesAfter ? 0 : EVENT_EDGE_GAP_PX;
  const top = minutesToPx(startMin) + topGap;
  const height = Math.max(MIN_EVENT_HEIGHT_PX, minutesToPx(endMin - startMin)) - topGap - bottomGap;

  return (
    <div
      onClick={ghost ? undefined : onClick}
      onPointerDown={ghost ? undefined : onPointerDown}
      className="absolute text-left"
      style={{
        top,
        height,
        left: `calc(${leftPct}% + ${EVENT_EDGE_GAP_PX / 2}px)`,
        width: `calc(${widthPct}% - ${EVENT_EDGE_GAP_PX}px)`,
        zIndex: zIndexOverride ?? (nested ? 1 : undefined),
        opacity: ghost ? 0.4 : undefined,
        pointerEvents: ghost ? "none" : undefined,
      }}
    >
      <EventBlockBody
        event={event}
        colorName={colorName}
        variant={variant}
        heightPx={height}
        nested={nested}
        continuesBefore={continuesBefore}
        continuesAfter={continuesAfter}
      />
    </div>
  );
}

interface EventBlockBodyProps {
  event: CalendarEvent;
  colorName: keyof typeof CALENDAR_COLORS;
  variant?: "tint" | "solid";
  /** Rendered height, used to decide whether the location/time detail lines show. */
  heightPx: number;
  nested?: boolean;
  /** The event continues from the previous day — square off the top corners so
   *  the bar reads as carrying over the midnight boundary. */
  continuesBefore?: boolean;
  /** The event continues onto the next day — square off the bottom corners. */
  continuesAfter?: boolean;
  /** Renders the two diagonal resize handles (top-right = start, bottom-left = end). */
  editing?: boolean;
  onResizeHandleDown?: (edge: ResizeEdge, e: ReactPointerEvent) => void;
}

/** The visual fill of an event block — accent capsule, tint/solid fill, text,
 *  and (while editing) the resize handles — filling whatever box wraps it. */
export function EventBlockBody({
  event,
  colorName,
  variant = "tint",
  heightPx,
  nested = false,
  continuesBefore = false,
  continuesAfter = false,
  editing = false,
  onResizeHandleDown,
}: EventBlockBodyProps) {
  const color = CALENDAR_COLORS[colorName];
  const isSolid = variant === "solid";
  const showDetails = heightPx >= DETAIL_DISCLOSURE_THRESHOLD_PX;
  const RADIUS = 7;

  return (
    <div className="relative h-full w-full">
      <div
        className="h-full w-full overflow-hidden"
        style={{
          backgroundColor: isSolid ? color.accent : nested ? hexToRgba(color.accent, 0.22) : color.tint,
          borderTopLeftRadius: continuesBefore ? 0 : RADIUS,
          borderTopRightRadius: continuesBefore ? 0 : RADIUS,
          borderBottomLeftRadius: continuesAfter ? 0 : RADIUS,
          borderBottomRightRadius: continuesAfter ? 0 : RADIUS,
          boxShadow: editing ? "0 6px 18px rgba(0,0,0,0.28)" : undefined,
        }}
      >
        {!isSolid && (
          <div
            className="absolute left-1 top-1 bottom-1 w-[3px] rounded-full"
            style={{ backgroundColor: color.accent }}
          />
        )}
        <div
          className="flex h-full flex-col gap-0.5 px-2 py-[3px]"
          style={{ color: isSolid ? "#fff" : color.text }}
        >
          <div className="flex items-start justify-between gap-1">
            <span className="truncate text-[12.5px] ml-0.5 font-semibold leading-tight">{event.title}</span>
            {event.recurrence && <RepeatIcon className="mt-0.5 h-3 w-3 shrink-0 opacity-70" />}
          </div>
          {showDetails && (
            <>
              {event.location && (
                <div className="flex items-center gap-1 text-[11.5px] opacity-85">
                  <PinIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{event.location.name}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-[11.5px] opacity-85">
                <ClockIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {formatEventTimeRange(new Date(event.start), new Date(event.end))}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {editing && (
        <>
          {/* Diagonal handles: top-right adjusts the start, bottom-left the end.
              Rendered outside the overflow-hidden fill so they straddle the edge. */}
          <ResizeHandle edge="start" onResizeHandleDown={onResizeHandleDown} />
          <ResizeHandle edge="end" onResizeHandleDown={onResizeHandleDown} />
        </>
      )}
    </div>
  );
}

function ResizeHandle({
  edge,
  onResizeHandleDown,
}: {
  edge: ResizeEdge;
  onResizeHandleDown?: (edge: ResizeEdge, e: ReactPointerEvent) => void;
}) {
  const atStart = edge === "start"; // top-right
  return (
    // Transparent 32px hit area — enlarged so the handle is easy to grab —
    // that centers the (unchanged) 12px visual dot exactly where it used to
    // sit. The old dot straddled the edge (center at the block's top/bottom)
    // and sat ~24px in from the left/right edge; the offsets below keep that
    // center fixed as the hit area grows around it (16px = half of 32px).
    <span
      role="button"
      aria-label={atStart ? "Adjust start time" : "Adjust end time"}
      onPointerDown={(e) => onResizeHandleDown?.(edge, e)}
      className="absolute z-10 flex h-[32px] w-[32px] items-center justify-center"
      style={{
        touchAction: "none",
        cursor: "ns-resize",
        ...(atStart ? { top: -16, right: 8 } : { bottom: -16, left: 8 }),
      }}
    >
      <span
        aria-hidden
        className="h-[12px] w-[12px] rounded-full border border-black/10 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
      />
    </span>
  );
}
