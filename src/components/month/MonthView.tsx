"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CalendarEvent, CalendarSource } from "@/lib/types";
import { dateKey, generateCalendarMonths, MONTH_NAMES } from "@/lib/date-utils";
import { TopNavBar } from "@/components/shared/TopNavBar";
import { BottomBar } from "@/components/shared/BottomBar";
import { TRANSITION_MS, TRANSITION_MS_AFTER_EXIT, TRANSITION_EASE } from "@/lib/transition-constants";
import { MonthWeekdayHeader } from "./MonthWeekdayHeader";
import { MonthWeekRow, type WeekTransitionPhase } from "./MonthWeekRow";

export interface MonthViewTransition {
  selectedWeekKey: string;
  mode: "exit" | "enter";
  armed: boolean;
}

interface MonthViewProps {
  today: Date;
  anchorDate: Date;
  events: CalendarEvent[];
  calendars: CalendarSource[];
  onSelectDate: (date: Date) => void;
  onGridView?: () => void;
  transition?: MonthViewTransition | null;
}

const MONTHS_BEFORE = 2;
const MONTHS_AFTER = 3;

/** Height (px) of the always-pinned nav bar + weekday-letter header above the scroll flow. */
const STICKY_HEADER_OFFSET_PX = 88;

export function MonthView({
  today,
  anchorDate,
  events,
  calendars,
  onSelectDate,
  onGridView,
  transition = null,
}: MonthViewProps) {
  const calendarsById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);

  const sections = useMemo(
    () =>
      generateCalendarMonths(
        anchorDate.getFullYear(),
        anchorDate.getMonth(),
        MONTHS_BEFORE,
        MONTHS_AFTER,
      ),
    [anchorDate],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const anchorSectionIndex = Math.max(
    0,
    sections.findIndex(
      (s) => s.year === anchorDate.getFullYear() && s.month === anchorDate.getMonth(),
    ),
  );
  const [visibleSectionIndex, setVisibleSectionIndex] = useState(anchorSectionIndex);

  function scrollToSection(index: number, smooth: boolean) {
    const container = scrollRef.current;
    const target = sectionRefs.current[index];
    if (!container || !target) return;
    // The nav+weekday header is sticky and doesn't reserve flow space, so a
    // naive scroll-to-top would tuck this section's first row behind it.
    // Compensate by scrolling exactly that header's height less far.
    const top = target.offsetTop - STICKY_HEADER_OFFSET_PX;
    container.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
  }

  useLayoutEffect(() => {
    scrollToSection(anchorSectionIndex, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      let bestIndex = 0;
      sectionRefs.current.forEach((el, i) => {
        if (!el) return;
        const delta = el.getBoundingClientRect().top - containerTop;
        if (delta <= STICKY_HEADER_OFFSET_PX + 1) bestIndex = i;
      });
      setVisibleSectionIndex(bestIndex);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [sections.length]);

  const visibleSection = sections[visibleSectionIndex] ?? sections[0];
  const isTodayMonth =
    visibleSection.year === today.getFullYear() && visibleSection.month === today.getMonth();
  const todayColumn = isTodayMonth ? today.getDay() : null;

  function handleToday() {
    const idx = sections.findIndex(
      (s) => s.year === today.getFullYear() && s.month === today.getMonth(),
    );
    if (idx >= 0) scrollToSection(idx, true);
  }

  // Weeks render in chronological order across sections, so a single running
  // flag tells us whether we've reached the transitioning row yet.
  let seenSelectedWeek = false;

  const chromeIsOff = transition ? (transition.mode === "exit" ? transition.armed : !transition.armed) : false;
  const chromeStyle = transition
    ? {
        opacity: chromeIsOff ? 0 : 1,
        transition: `opacity ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
      }
    : undefined;

  // Top/bottom toolbars sit above sliding "after" rows (z-30) and crossfade
  // with the rest of the chrome so the back label can change mid-transition
  // instead of staying frozen on the exiting copy (which would get covered
  // once month is stacked over day).
  const navStyle = chromeStyle;

  return (
    <div className={`fixed inset-0 overflow-hidden ${transition ? "pointer-events-none" : ""}`}>
      <div ref={scrollRef} className="no-scrollbar absolute inset-0 overflow-y-auto pb-28">
        <div className="sticky top-0 z-20">
          {/* Single frosted pane spanning the nav band height + header content
              so there is one continuous backdrop-blur region — no seam. The
              invisible twin lives inside it so its height is part of the same
              blur surface, while the real toolbar is an absolute z-40 sibling
              (transparent) that can stack above sliding "after" rows. */}
          <div className="bg-white/60 backdrop-blur-sm dark:bg-black/60" style={chromeStyle}>
            <div className="invisible" aria-hidden>
              <TopNavBar backLabel={`${visibleSection.year}`} onBack={() => {}} />
            </div>
            <div className="px-4 pb-1 pt-1">
              <h1 className="text-[34px] font-bold leading-tight">
                {MONTH_NAMES[visibleSection.month]}
              </h1>
            </div>
            <MonthWeekdayHeader highlightColumn={todayColumn} />
          </div>
        </div>

        {sections.map((section, i) => {
          const firstOfMonthColumn = new Date(section.year, section.month, 1).getDay();
          // Clamp so the label never starts so close to the right edge that
          // a long month name (e.g. "September") would run off-screen.
          const labelColumn = Math.min(firstOfMonthColumn, 4);
          // The section's month-name header sits above all its weeks, so it
          // travels with whichever direction is true at this point in the
          // chronological scan (mirrors the "before"/"after" row treatment).
          const headerPhase: WeekTransitionPhase | null = !transition
            ? null
            : seenSelectedWeek
              ? "after"
              : "before";
          const headerIsOff = transition
            ? transition.mode === "exit"
              ? transition.armed
              : !transition.armed
            : false;
          // Mirrors MonthWeekRow's duration bump so an "after" section's
          // header doesn't detach from its (slower-exiting) week rows.
          const headerDurationMs =
            transition?.mode === "exit" && headerPhase === "after" ? TRANSITION_MS_AFTER_EXIT : TRANSITION_MS;
          const headerStyle = transition
            ? {
                transform: headerIsOff
                  ? headerPhase === "after"
                    ? "translateY(100vh)"
                    : "translateY(-100vh)"
                  : "translateY(0)",
                // Fade out while exiting, but stay fully opaque while
                // entering so headers don't visibly fade in as they slide.
                opacity: headerIsOff && transition.mode === "exit" ? 0 : 1,
                // Match MonthWeekRow: "after" headers ride above the day
                // layer / earlier weeks while they travel.
                zIndex: headerPhase === "after" ? 30 : undefined,
                position: headerPhase === "after" ? ("relative" as const) : undefined,
                transition: `transform ${headerDurationMs}ms ${TRANSITION_EASE}, opacity ${headerDurationMs}ms ${TRANSITION_EASE}`,

              }
            : undefined;
          return (
            <div key={`${section.year}-${section.month}`} ref={(el) => { sectionRefs.current[i] = el; }}>
              <div className="grid grid-cols-7 pb-1 pt-4" style={headerStyle}>
                <h2
                  className="whitespace-nowrap pl-1 text-[26px] font-bold leading-tight"
                  style={{ gridColumnStart: labelColumn + 1 }}
                >
                  {MONTH_NAMES[section.month]}
                </h2>
              </div>
              {section.weeks.map((week) => {
                const weekKey = dateKey(week.days[0].date);
                const isSelectedWeek = transition?.selectedWeekKey === weekKey;
                const phase = !transition ? null : isSelectedWeek ? "selected" : seenSelectedWeek ? "after" : "before";
                if (isSelectedWeek) seenSelectedWeek = true;
                return (
                  <MonthWeekRow
                    key={weekKey}
                    weekLabel={week.weekLabel}
                    days={week.days}
                    events={events}
                    calendarsById={calendarsById}
                    today={today}
                    onSelectDate={onSelectDate}
                    transitionPhase={phase}
                    transitionMode={transition?.mode ?? null}
                    transitionArmed={transition?.armed ?? false}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Toolbars are siblings of the scroll layer (not inside it) so their
          z-index can sit above sliding "after" rows, and so the top bar isn't
          trapped under sticky week chrome. */}
      <div className="absolute inset-x-0 top-0 z-40" style={navStyle}>
        <TopNavBar backLabel={`${visibleSection.year}`} onBack={() => {}} />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-40" style={navStyle}>
        <BottomBar onToday={handleToday} onGridView={onGridView} />
      </div>
    </div>
  );
}
