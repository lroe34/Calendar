"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { BottomBar } from "@/components/shared/BottomBar";
import { PlusIcon, SearchIcon } from "@/components/shared/Icons";
import { TRANSITION_MS, TRANSITION_EASE } from "@/lib/transition-constants";
import { MiniMonthCard } from "./MiniMonthCard";

export interface YearViewTransition {
  /** "enter": year view is arriving (month is zooming out into it). "exit": year view is leaving (a tapped month is zooming up over it). */
  mode: "enter" | "exit";
  targetYear: number;
  targetMonth: number;
  /** Flips true one frame after mount so the off/resting swap is observed by the browser as a transition. */
  armed: boolean;
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
  const [siblingOffsets, setSiblingOffsets] = useState<Record<number, { dx: number; dy: number }> | null>(null);
  const measuredForRef = useRef<string | null>(null);

  // Direction is derived from each card's row/column in the (uniform,
  // 3-column) grid rather than measured via getBoundingClientRect. A forced
  // synchronous reflow here — even just one, even for only the target card —
  // lands in the same tick as the offset state landing on these freshly-
  // mounted cards and, for reasons that sit below what the CSS Transitions
  // spec pins down, makes the browser skip treating that as a real "from"
  // frame: the transition never triggers and every card just snaps straight
  // to rest instead of flying in. Row/column deltas give the same radial
  // direction on this evenly-spaced grid without ever touching layout.
  const GRID_COLUMNS = 3;

  useLayoutEffect(() => {
    if (!transition) {
      measuredForRef.current = null;
      setSiblingOffsets(null);
      return;
    }
    const key = `${transition.targetYear}-${transition.targetMonth}`;
    if (measuredForRef.current === key) return;
    const targetCol = transition.targetMonth % GRID_COLUMNS;
    const targetRow = Math.floor(transition.targetMonth / GRID_COLUMNS);
    const travel = Math.hypot(window.innerWidth, window.innerHeight);
    const offsets: Record<number, { dx: number; dy: number }> = {};
    for (let m = 0; m < 12; m++) {
      if (m === transition.targetMonth) continue;
      const col = m % GRID_COLUMNS;
      const row = Math.floor(m / GRID_COLUMNS);
      const vx = col - targetCol;
      const vy = row - targetRow;
      const len = Math.hypot(vx, vy) || 1;
      offsets[m] = { dx: (vx / len) * travel, dy: (vy / len) * travel };
    }
    measuredForRef.current = key;
    setSiblingOffsets(offsets);
  }, [transition]);

  // "displaced": pushed out past the edge and invisible — the state both
  // directions share while the month layer on top is opaque. Mirrors
  // MonthWeekRow's exit/enter off-state convention.
  const displaced = transition ? (transition.mode === "exit" ? transition.armed : !transition.armed) : false;

  function cardStyle(year: number, month: number): CSSProperties | undefined {
    if (!transition || transition.targetYear !== year) return undefined;
    const isTarget = month === transition.targetMonth;
    const offset = !isTarget ? siblingOffsets?.[month] : undefined;
    if (!isTarget && !offset) return undefined;
    return {
      transform: displaced && offset ? `translate(${offset.dx}px, ${offset.dy}px)` : "translate(0px, 0px)",
      opacity: displaced ? 0 : 1,
      transition: `transform ${TRANSITION_MS}ms ${TRANSITION_EASE}, opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
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
