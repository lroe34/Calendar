"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { BottomBar } from "@/components/shared/BottomBar";
import { PlusIcon, SearchIcon } from "@/components/shared/Icons";
import { TRANSITION_MS, TRANSITION_EASE } from "@/lib/transition-constants";
import type { FlyingRect } from "@/components/transitions/FlyingDayNumbers";
import { MiniMonthCard } from "./MiniMonthCard";

export interface YearViewTransition {
  /** "enter": year view is arriving (month is zooming out into it). "exit": year view is leaving (a tapped month is zooming up over it). */
  mode: "enter" | "exit";
  targetYear: number;
  targetMonth: number;
  /** Flips true one frame after mount so the off/resting swap is observed by the browser as a transition. */
  armed: boolean;
  /** The target card's own measured rect, used to aim its scale-up-toward-center motion. Null only for the brief window before "enter" mode has measured it. */
  smallRect: FlyingRect | null;
}

interface YearViewProps {
  today: Date;
  anchorYear: number;
  onSelectMonth: (year: number, month: number) => void;
  onGridView?: () => void;
  transition?: YearViewTransition | null;
}

const YEARS_BEFORE = 1;
const YEARS_AFTER = 1;

export function YearView({ today, anchorYear, onSelectMonth, onGridView, transition = null }: YearViewProps) {
  const years = Array.from(
    { length: YEARS_BEFORE + YEARS_AFTER + 1 },
    (_, i) => anchorYear - YEARS_BEFORE + i,
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const anchorIndex = years.indexOf(anchorYear);

  function scrollToIndex(index: number, smooth: boolean) {
    const container = scrollRef.current;
    const target = sectionRefs.current[index];
    if (!container || !target) return;
    container.scrollTo({ top: target.offsetTop, behavior: smooth ? "smooth" : "auto" });
  }

  useLayoutEffect(() => {
    scrollToIndex(anchorIndex, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToday() {
    const idx = years.indexOf(today.getFullYear());
    if (idx >= 0) scrollToIndex(idx, true);
  }

  // Per-card pixel offset that pushes each of the target month's 11 siblings
  // further out past the viewport edge, along the line from the target card
  // through that sibling — the shared "displaced" endpoint both directions
  // animate toward/from, so the grid reads as flying in from off-screen (or
  // out past the edges) around whichever month is being zoomed, rather than
  // just sitting static underneath the month layer.
  //
  // Direction comes from each card's row/column in the (uniform, 3-column)
  // grid, computed inline instead of measured via getBoundingClientRect (and
  // instead of a separate effect + state populated after mount). Both of
  // those would put a card's very first painted frame at "no style yet"
  // (or, with a measuring effect, at rest) with the "off" position only
  // landing on a *later* commit — and for reasons that sit below what the
  // CSS Transitions spec pins down, a forced reflow or a second cascaded
  // commit landing that close to the following "on" commit makes the
  // browser skip treating "off" as a real prior frame, so the transition
  // never triggers and every card just snaps straight to rest. Computing it
  // synchronously during render means "off" is what a card's first paint
  // already shows, so the only style change left to animate is off -> on.
  const GRID_COLUMNS = 3;

  function radialOffset(targetMonth: number, month: number): { dx: number; dy: number } {
    const targetCol = targetMonth % GRID_COLUMNS;
    const targetRow = Math.floor(targetMonth / GRID_COLUMNS);
    const col = month % GRID_COLUMNS;
    const row = Math.floor(month / GRID_COLUMNS);
    const vx = col - targetCol;
    const vy = row - targetRow;
    const len = Math.hypot(vx, vy) || 1;
    const travel = typeof window === "undefined" ? 0 : Math.hypot(window.innerWidth, window.innerHeight);
    return { dx: (vx / len) * travel, dy: (vy / len) * travel };
  }

  // How far the target card itself travels toward the viewport's center, and
  // how much it scales up, as it fades — its half of the crossfade with the
  // month layer growing from that same rect. The month layer (see
  // CalendarApp's smallRectTransform) shrinks onto this same rect by
  // `rect.width / innerWidth`; scaling the card up by the exact inverse
  // means it reaches full-viewport size right as the month layer does, so
  // the swap reads as one continuous zoom rather than a mismatched jump in
  // scale once the crossfade lands.
  function targetScale(rect: FlyingRect): number {
    return window.innerWidth / rect.width;
  }

  function targetCenterOffset(rect: FlyingRect): { dx: number; dy: number } {
    const rectCenterX = rect.left + rect.width / 2;
    const rectCenterY = rect.top + rect.height / 2;
    return {
      dx: window.innerWidth / 2 - rectCenterX,
      dy: window.innerHeight / 2 - rectCenterY,
    };
  }

  // "displaced": pushed out past the edge and invisible — the state both
  // directions share while the month layer on top is opaque. Mirrors
  // MonthWeekRow's exit/enter off-state convention.
  const displaced = transition ? (transition.mode === "exit" ? transition.armed : !transition.armed) : false;

  function cardStyle(year: number, month: number): CSSProperties | undefined {
    if (!transition || transition.targetYear !== year) return undefined;
    const isTarget = month === transition.targetMonth;
    const offset = !isTarget ? radialOffset(transition.targetMonth, month) : undefined;
    // On entry, opacity ramps in over a shorter, front-loaded window than
    // the transform (mirrors the month layer's own reveal below): fading in
    // quickly makes the card visible well before it's finished traveling,
    // so the rest of its trip in actually reads as motion instead of a
    // last-instant pop once the month layer above finally clears. Exit
    // keeps the shared curve — its cards start fully visible at rest, so
    // there's no reveal to race ahead of.
    const opacityTransition =
      transition.mode === "enter"
        ? `opacity ${Math.round(TRANSITION_MS * 0.4)}ms ease-out`
        : `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}`;
    // Only known once "enter" mode has measured the card post-mount (see the
    // smallRect effect in CalendarApp); until then the target briefly falls
    // back to the plain in-place fade below, same as before this rect existed.
    const targetOffset =
      isTarget && transition.smallRect ? targetCenterOffset(transition.smallRect) : null;
    const transform = !displaced
      ? "translate(0px, 0px) scale(1)"
      : isTarget
        ? targetOffset && transition.smallRect
          ? `translate(${targetOffset.dx}px, ${targetOffset.dy}px) scale(${targetScale(transition.smallRect)})`
          : "translate(0px, 0px) scale(1)"
        : offset
          ? `translate(${offset.dx}px, ${offset.dy}px)`
          : "translate(0px, 0px)";
    // The target's centered/scaled-up "off" position only becomes known once
    // smallRect is measured (a frame or more after mount), so unlike the
    // siblings' off state it isn't there from the very first paint. Letting
    // that arrival itself transition (from the identity fallback) would eat
    // into the card's travel before "armed" even flips, so it's suppressed
    // here — the card jumps straight to its off position — and the real
    // animation only starts once "armed" switches this back on for the trip
    // to rest.
    const cardTransition =
      isTarget && transition.mode === "enter" && !transition.armed
        ? "none"
        : `transform ${TRANSITION_MS}ms ${TRANSITION_EASE}, ${opacityTransition}`;
    return {
      transform,
      opacity: displaced ? 0 : 1,
      transition: cardTransition,
    };
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-white dark:bg-black">
      <div
        ref={scrollRef}
        className="no-scrollbar absolute inset-0 overflow-y-auto pb-28 pt-16"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 56px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 56px)",
        }}
      >
        {years.map((year, i) => {
          const isCurrentYear = year === today.getFullYear();
          return (
            <div
              key={year}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              className="px-4 pb-10"
            >
              <h1
                className={`mb-6 text-center text-[40px] font-bold leading-tight ${
                  isCurrentYear ? "text-red-500" : "text-black dark:text-white"
                }`}
              >
                {year}
              </h1>
              <div className="grid grid-cols-3 gap-x-4 gap-y-9">
                {Array.from({ length: 12 }, (_, month) => (
                  <MiniMonthCard
                    key={month}
                    year={year}
                    month={month}
                    today={today}
                    onSelect={onSelectMonth}
                    style={cardStyle(year, month)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-end px-4 pt-3">
        <div className="pointer-events-auto flex items-center gap-5 rounded-full bg-black/[.05] px-4 py-2 dark:bg-white/10">
          <button aria-label="Search" className="text-black dark:text-white">
            <SearchIcon className="h-5 w-5" />
          </button>
          <button aria-label="Add event" className="text-black dark:text-white">
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-40">
        <BottomBar onToday={handleToday} onGridView={onGridView} inboxBadge={1} />
      </div>
    </div>
  );
}
