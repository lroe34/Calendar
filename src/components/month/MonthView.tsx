"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarEvent, CalendarSource } from "@/lib/types";
import { generateCalendarMonths, MONTH_NAMES } from "@/lib/date-utils";
import { TopNavBar } from "@/components/shared/TopNavBar";
import { BottomBar } from "@/components/shared/BottomBar";
import { MonthWeekdayHeader } from "./MonthWeekdayHeader";
import { MonthWeekRow } from "./MonthWeekRow";

interface MonthViewProps {
  today: Date;
  anchorDate: Date;
  events: CalendarEvent[];
  calendars: CalendarSource[];
  onSelectDate: (date: Date) => void;
}

const MONTHS_BEFORE = 2;
const MONTHS_AFTER = 3;

/** Height (px) of the always-pinned nav bar + weekday-letter header above the scroll flow. */
const STICKY_HEADER_OFFSET_PX = 88;

export function MonthView({ today, anchorDate, events, calendars, onSelectDate }: MonthViewProps) {
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
    // CSS `position: sticky` doesn't reserve space for its stuck offset, so a
    // naive scrollIntoView leaves this section's own sticky title overlapping
    // its first row. Compensate by scrolling exactly that offset less far.
    const top = target.offsetTop - STICKY_HEADER_OFFSET_PX;
    container.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
  }

  useEffect(() => {
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

  return (
    <div className="relative h-dvh overflow-hidden">
      <div ref={scrollRef} className="no-scrollbar absolute inset-0 overflow-y-auto pb-28">
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl dark:bg-black/80">
          <TopNavBar backLabel={`${visibleSection.year}`} onBack={() => {}} />
          <MonthWeekdayHeader highlightColumn={todayColumn} />
        </div>

        {sections.map((section, i) => (
          <div key={`${section.year}-${section.month}`} ref={(el) => { sectionRefs.current[i] = el; }}>
            <div
              className="sticky z-10 bg-white/95 px-4 pb-1 pt-2 backdrop-blur-xl dark:bg-black/80"
              style={{ top: STICKY_HEADER_OFFSET_PX }}
            >
              <h1 className="text-[34px] font-bold leading-tight">{MONTH_NAMES[section.month]}</h1>
            </div>
            {section.weeks.map((week) => (
              <MonthWeekRow
                key={week.days[0].date.toISOString()}
                weekLabel={week.weekLabel}
                days={week.days}
                events={events}
                calendarsById={calendarsById}
                today={today}
                onSelectDate={onSelectDate}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20">
        <BottomBar onToday={handleToday} />
      </div>
    </div>
  );
}
