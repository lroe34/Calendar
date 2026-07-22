import type { PointerEvent as ReactPointerEvent } from "react";
import type { CalendarEvent } from "@/lib/types";
import { CALENDAR_COLORS } from "@/lib/colors";
import {
  DETAIL_DISCLOSURE_THRESHOLD_PX,
  EVENT_EDGE_GAP_PX,
  MIN_EVENT_HEIGHT_PX,
  minutesToPx,
} from "@/lib/day-grid";
import { formatEventTimeRange, minutesSinceMidnight } from "@/lib/date-utils";
import { ClockIcon, PinIcon, RepeatIcon } from "@/components/shared/Icons";

export type ResizeEdge = "start" | "end";

interface EventBlockProps {
  event: CalendarEvent;
  colorName: keyof typeof CALENDAR_COLORS;
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
  /** Renders the two diagonal resize handles (top-right = start, bottom-left =
   * end) and lifts the block above its neighbors. */
  editing?: boolean;
  /** Explicit stacking order (used to sit the ghost above the exit-edit backdrop). */
  zIndexOverride?: number;
  onClick?: () => void;
  onPointerDown?: (e: ReactPointerEvent) => void;
  /** Fired when one of the resize handles is grabbed. */
  onResizeHandleDown?: (edge: ResizeEdge, e: ReactPointerEvent) => void;
}

export function EventBlock({
  event,
  colorName,
  leftPct,
  widthPct,
  nested = false,
  variant = "tint",
  ghost = false,
  editing = false,
  zIndexOverride,
  onClick,
  onPointerDown,
  onResizeHandleDown,
}: EventBlockProps) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const top = minutesToPx(minutesSinceMidnight(start)) + EVENT_EDGE_GAP_PX;
  const height =
    Math.max(
      MIN_EVENT_HEIGHT_PX,
      minutesToPx(minutesSinceMidnight(end) - minutesSinceMidnight(start)),
    ) -
    EVENT_EDGE_GAP_PX * 2;
  const color = CALENDAR_COLORS[colorName];
  const showDetails = height >= DETAIL_DISCLOSURE_THRESHOLD_PX;
  const isSolid = variant === "solid";

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
        zIndex: editing ? 30 : (zIndexOverride ?? (nested ? 1 : undefined)),
        opacity: ghost ? 0.4 : undefined,
        pointerEvents: ghost ? "none" : undefined,
        touchAction: editing ? "none" : undefined,
        cursor: editing ? "grabbing" : undefined,
      }}
    >
      <div
        className="h-full w-full overflow-hidden rounded-[7px]"
        style={{
          backgroundColor: isSolid ? color.accent : color.tint,
          boxShadow: editing
            ? "0 6px 18px rgba(0,0,0,0.28)"
            : nested
              ? "0 1px 6px rgba(0,0,0,0.18)"
              : undefined,
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
                <span className="truncate">{formatEventTimeRange(start, end)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {editing && (
        <>
          {/* Diagonal handles: top-right adjusts the start, bottom-left the end.
              Rendered outside the overflow-hidden fill so they can straddle the
              block edge like the reference. */}
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
    <span
      role="button"
      aria-label={atStart ? "Adjust start time" : "Adjust end time"}
      onPointerDown={(e) => {
        // Keep the block's own move-drag from also starting.
        e.stopPropagation();
        onResizeHandleDown?.(edge, e);
      }}
      className="absolute h-[15px] w-[15px] rounded-full border border-black/10 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
      style={{
        touchAction: "none",
        cursor: "ns-resize",
        ...(atStart ? { top: -7, right: -7 } : { bottom: -7, left: -7 }),
      }}
    />
  );
}
