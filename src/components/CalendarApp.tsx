"use client";

import { useLayoutEffect, useState, type CSSProperties } from "react";
import { MonthView } from "@/components/month/MonthView";
import { DayView } from "@/components/day/DayView";
import { YearView } from "@/components/year/YearView";
import { EventDetailSheet } from "@/components/event-sheet/EventDetailSheet";
import { CalendarListDrawer } from "@/components/shared/CalendarListDrawer";
import { CalendarEditDrawer } from "@/components/shared/CalendarEditDrawer";
import { FlyingDayNumbers, type FlyingRect } from "@/components/transitions/FlyingDayNumbers";
import { calendars as initialCalendars, events as initialEvents, reminders } from "@/lib/mock-data";
import { addDays, dateKey, startOfDay, startOfWeek } from "@/lib/date-utils";
import { TRANSITION_MS, TRANSITION_MS_AFTER_EXIT, TRANSITION_EASE } from "@/lib/transition-constants";
import type { CalendarEvent, CalendarSource } from "@/lib/types";

type Screen = "month" | "day" | "year";

/**
 * Month <-> Year "zoom": the month screen fills the viewport for exactly one
 * month, so it doubles as that month's own matched-geometry frame — no need
 * to isolate a sub-rect within it. Shrinking/growing the whole fixed month
 * layer between the full viewport and the tapped mini-card's measured rect
 * (leaving the year layer static underneath) reproduces the zoom with a
 * single transform instead of per-cell FLIP.
 */
interface YearTransition {
  mode: "toYear" | "toMonth";
  year: number;
  month: number;
  /** The mini-card's measured rect: known synchronously (toMonth, tapped) or after YearView mounts (toYear). */
  smallRect: FlyingRect | null;
  armed: boolean;
}

function smallRectTransform(rect: FlyingRect): CSSProperties {
  const scale = rect.width / window.innerWidth;
  return {
    transform: `translate(${rect.left}px, ${rect.top}px) scale(${scale})`,
    transformOrigin: "0 0",
  };
}

interface Transition {
  mode: "toDay" | "toMonth";
  /** The date that anchors the transition: tapped in month view, or the day view's selected date when going back. */
  date: Date;
  selectedWeekKey: string;
  weekDays: Date[];
  fromRects: (FlyingRect | null)[];
  toRects: (FlyingRect | null)[] | null;
  /**
   * Vertical distance the flying day-numbers travel (month week ↔ mini strip).
   * Null until `toRects` are measured; DayView uses this for its content slide.
   */
  slideDistancePx: number | null;
  armed: boolean;
}

/** How far the week day-numbers move between the two measured layouts. */
function verticalTravelPx(
  fromRects: (FlyingRect | null)[],
  toRects: (FlyingRect | null)[],
): number {
  for (let i = 0; i < fromRects.length; i++) {
    const from = fromRects[i];
    const to = toRects[i];
    if (from && to) return Math.abs(from.top - to.top);
  }
  return 0;
}

function measureRects(selector: (key: string) => string, weekDays: Date[]): (FlyingRect | null)[] {
  return weekDays.map((d) => {
    const el = document.querySelector<HTMLElement>(selector(dateKey(d)));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
}

const measureMiniStripRects = (weekDays: Date[]) =>
  measureRects((key) => `[data-cal-ministrip] [data-cal-daynum="${key}"]`, weekDays);

// Unlike the mini week strip, a month week row is itself CSS-transformed
// (translated off-screen) while its view is still "unarmed" — that's how it
// starts positioned for the enter animation. Measuring through that
// transform would capture the row's off-screen position instead of its
// resting one, so it's neutralized for the instant of measurement.
function measureMonthRects(weekDays: Date[]): (FlyingRect | null)[] {
  return weekDays.map((d) => {
    const el = document.querySelector<HTMLElement>(`[data-cal-daynum="${dateKey(d)}"]`);
    if (!el) return null;
    const row = el.closest<HTMLElement>("[data-cal-week]");
    const prevTransform = row?.style.transform ?? "";
    const prevTransition = row?.style.transition ?? "";
    if (row) {
      row.style.transition = "none";
      row.style.transform = "none";
    }
    const r = el.getBoundingClientRect();
    if (row) {
      row.style.transform = prevTransform;
      row.style.transition = prevTransition;
    }
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
}

export function CalendarApp() {
  const today = startOfDay(new Date());
  const [screen, setScreen] = useState<Screen>("month");
  const [selectedDate, setSelectedDate] = useState(today);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [yearTransition, setYearTransition] = useState<YearTransition | null>(null);
  const [yearViewAnchor, setYearViewAnchor] = useState(today.getFullYear());
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [calendars, setCalendars] = useState<CalendarSource[]>(initialCalendars);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [calendarListOpen, setCalendarListOpen] = useState(false);
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null);
  const editingCalendar = editingCalendarId
    ? (calendars.find((c) => c.id === editingCalendarId) ?? null)
    : null;
  const visibleEvents = events.filter(
    (e) => calendars.find((c) => c.id === e.calendarId)?.visible !== false,
  );
  // Kept mounted (even while closed) so Vaul's close/drag-to-dismiss
  // animation has something to animate away, instead of the content
  // vanishing the instant `open` flips to false. Updated during render
  // (React's sanctioned "adjust state while rendering" pattern) rather than
  // via an effect, since this is deriving state from props, not
  // synchronizing with an external system.
  const [sheetEvent, setSheetEvent] = useState<CalendarEvent | null>(null);
  const liveOpenEvent = openEventId ? (events.find((e) => e.id === openEventId) ?? null) : null;
  if (liveOpenEvent && liveOpenEvent !== sheetEvent) {
    setSheetEvent(liveOpenEvent);
  }

  function weekDaysFor(date: Date): Date[] {
    const start = startOfWeek(date);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }

  function handleSelectDateFromMonth(date: Date) {
    if (transition || yearTransition) return;
    const weekDays = weekDaysFor(date);
    setTransition({
      mode: "toDay",
      date,
      selectedWeekKey: dateKey(weekDays[0]),
      weekDays,
      fromRects: measureMonthRects(weekDays),
      toRects: null,
      slideDistancePx: null,
      armed: false,
    });
    setSelectedDate(startOfDay(date));
  }

  function handleBackToMonth() {
    if (transition || yearTransition) return;
    const weekDays = weekDaysFor(selectedDate);
    setTransition({
      mode: "toMonth",
      date: selectedDate,
      selectedWeekKey: dateKey(weekDays[0]),
      weekDays,
      fromRects: measureMiniStripRects(weekDays),
      toRects: null,
      slideDistancePx: null,
      armed: false,
    });
  }

  // Once the entering view has mounted, measure its target rects (and the
  // day-number travel distance DayView slides by), then flip `armed` a
  // frame later so the browser observes a from -> to transition.
  //
  // toDay can measure synchronously: DayView's mini strip is already at
  // rest in this same commit, and we need slideDistancePx before the first
  // paint so the content's "off" transform isn't stuck at 0.
  // toMonth still defers into a rAF so MonthView's mount scroll can settle
  // before we read month-cell rects.
  useLayoutEffect(() => {
    if (!transition || transition.toRects) return;

    const applyToRects = (toRects: (FlyingRect | null)[]) => {
      const slideDistancePx = verticalTravelPx(transition.fromRects, toRects);
      setTransition((t) =>
        t && !t.toRects ? { ...t, toRects, slideDistancePx } : t,
      );
    };

    if (transition.mode === "toDay") {
      applyToRects(measureMiniStripRects(transition.weekDays));
      return;
    }

    const raf = requestAnimationFrame(() => {
      applyToRects(measureMonthRects(transition.weekDays));
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transition?.toRects === null]);

  useLayoutEffect(() => {
    if (!transition || !transition.toRects || transition.armed) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setTransition((t) => (t ? { ...t, armed: true } : t));
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transition?.toRects, transition?.armed]);

  useLayoutEffect(() => {
    if (!transition || !transition.armed) return;
    // Below-the-fold ("after") week rows animate off over
    // TRANSITION_MS_AFTER_EXIT during a toDay transition, so MonthView must
    // stay mounted at least that long or its exit gets cut off mid-flight.
    const timeoutMs = transition.mode === "toDay" ? TRANSITION_MS_AFTER_EXIT : TRANSITION_MS;
    const timer = setTimeout(() => {
      setScreen(transition.mode === "toDay" ? "day" : "month");
      setTransition(null);
    }, timeoutMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transition?.armed]);

  function handleGoToYear(year: number, month: number) {
    if (transition || yearTransition) return;
    setYearViewAnchor(year);
    setYearTransition({ mode: "toYear", year, month, smallRect: null, armed: false });
  }

  function handleSelectMonthFromYear(year: number, month: number) {
    if (transition || yearTransition) return;
    const el = document.querySelector<HTMLElement>(`[data-cal-year-month="${year}-${month}"]`);
    const r = el?.getBoundingClientRect();
    const smallRect: FlyingRect | null = r
      ? { left: r.left, top: r.top, width: r.width, height: r.height }
      : null;
    setSelectedDate(new Date(year, month, 1));
    setYearTransition({ mode: "toMonth", year, month, smallRect, armed: false });
  }

  // toYear only: the mini-card destination isn't known until YearView has
  // mounted (and scrolled to its anchor year, which happens synchronously in
  // its own layout effect first). toMonth already has its rect measured
  // synchronously at tap time, so this is a no-op for that direction.
  useLayoutEffect(() => {
    if (!yearTransition || yearTransition.mode !== "toYear" || yearTransition.smallRect) return;
    const el = document.querySelector<HTMLElement>(
      `[data-cal-year-month="${yearTransition.year}-${yearTransition.month}"]`,
    );
    if (!el) return;
    const r = el.getBoundingClientRect();
    const smallRect: FlyingRect = { left: r.left, top: r.top, width: r.width, height: r.height };
    setYearTransition((t) => (t && !t.smallRect ? { ...t, smallRect } : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearTransition?.mode === "toYear" && !yearTransition.smallRect]);

  useLayoutEffect(() => {
    if (!yearTransition || !yearTransition.smallRect || yearTransition.armed) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setYearTransition((t) => (t ? { ...t, armed: true } : t));
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearTransition?.smallRect, yearTransition?.armed]);

  useLayoutEffect(() => {
    if (!yearTransition || !yearTransition.armed) return;
    const timer = setTimeout(() => {
      setScreen(yearTransition.mode === "toYear" ? "year" : "month");
      setYearTransition(null);
    }, TRANSITION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearTransition?.armed]);

  function handleSaveEvent(updated: CalendarEvent) {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  function handleDeleteEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setOpenEventId(null);
  }

  function handleToggleCalendar(id: string) {
    setCalendars((prev) => prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }

  function handleSaveCalendar(updated: CalendarSource) {
    setCalendars((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  const renderMonth = screen === "month" || transition?.mode === "toMonth" || !!yearTransition;
  const renderDay = screen === "day" || transition?.mode === "toDay";
  const renderYear = screen === "year" || !!yearTransition;

  // Month stays above day in both directions. "After" week/month rows slide
  // over the day layer (down on exit, up on enter); if day were stacked in
  // front they'd get covered mid-flight. DOM order alone can't express this
  // since it's the same fixed pair regardless of direction, so it's driven
  // explicitly by z-index instead.
  const monthZ = transition || yearTransition ? 2 : undefined;
  const dayZ = transition ? 1 : undefined;
  const yearZ = yearTransition ? 1 : undefined;

  // Month is always the layer that visibly scales during a year transition
  // (year itself is static underneath); it stays fully opaque throughout so
  // the motion reads as a pure zoom rather than a cross-fade. "armed" is the
  // resting/settled side of the animation in both directions (identity for
  // toMonth, the mini-card rect for toYear); the CSS transition on `transform`
  // animates between whichever two states that resolves to.
  const monthYearStyle: CSSProperties | undefined = yearTransition
    ? {
        ...(yearTransition.mode === "toYear"
          ? yearTransition.armed && yearTransition.smallRect
            ? smallRectTransform(yearTransition.smallRect)
            : { transform: "translate(0px, 0px) scale(1)", transformOrigin: "0 0" }
          : yearTransition.armed
            ? { transform: "translate(0px, 0px) scale(1)", transformOrigin: "0 0" }
            : yearTransition.smallRect
              ? smallRectTransform(yearTransition.smallRect)
              : { transform: "translate(0px, 0px) scale(1)", transformOrigin: "0 0" }),
        transition: `transform ${TRANSITION_MS}ms ${TRANSITION_EASE}`,
      }
    : undefined;

  // These wrappers are otherwise plain, unstyled boxes, but each one is
  // fixed and covers the full screen — a stray default `pointer-events: auto`
  // would let the (invisible) wrapper itself catch every tap/scroll and
  // block whatever's stacked underneath, regardless of the pointer-events
  // the mounted view sets on its own root. Opting both out during a
  // transition leaves that decision entirely to the views, which already
  // opt individual pieces (like the day view's scroll container) back in.
  return (
    <>
      {renderMonth && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: monthZ,
            pointerEvents: transition || yearTransition ? "none" : undefined,
            ...monthYearStyle,
          }}
        >
          <MonthView
            today={today}
            anchorDate={selectedDate}
            events={visibleEvents}
            calendars={calendars}
            onSelectDate={handleSelectDateFromMonth}
            onBack={handleGoToYear}
            onGridView={() => setCalendarListOpen(true)}
            transition={
              transition
                ? {
                    selectedWeekKey: transition.selectedWeekKey,
                    mode: transition.mode === "toDay" ? "exit" : "enter",
                    armed: transition.armed,
                  }
                : null
            }
          />
        </div>
      )}

      {renderYear && (
        <div style={{ position: "fixed", inset: 0, zIndex: yearZ, pointerEvents: yearTransition ? "none" : undefined }}>
          <YearView
            today={today}
            anchorYear={yearTransition ? yearTransition.year : yearViewAnchor}
            onSelectMonth={handleSelectMonthFromYear}
            onGridView={() => setCalendarListOpen(true)}
          />
        </div>
      )}

      {renderDay && (
        <div style={{ position: "fixed", inset: 0, zIndex: dayZ, pointerEvents: transition ? "none" : undefined }}>
          <DayView
            today={today}
            selectedDate={selectedDate}
            events={visibleEvents}
            reminders={reminders}
            calendars={calendars}
            onSelectDate={(date) => setSelectedDate(startOfDay(date))}
            onBack={handleBackToMonth}
            onSelectEvent={(event) => setOpenEventId(event.id)}
            onGridView={() => setCalendarListOpen(true)}
            transition={
              transition
                ? {
                    mode: transition.mode === "toDay" ? "enter" : "exit",
                    armed: transition.armed,
                    hiddenDayKeys: new Set(
                      transition.weekDays
                        .filter((_, i) => transition.fromRects[i] && transition.toRects?.[i] !== null)
                        .map(dateKey),
                    ),
                    slideDistancePx: transition.slideDistancePx,
                  }
                : null
            }
          />
        </div>
      )}

      {transition && (
        <FlyingDayNumbers
          days={transition.weekDays}
          today={today}
          activeDate={transition.date}
          fromRects={transition.fromRects}
          toRects={transition.toRects}
          armed={transition.armed}
          pillAppears={transition.mode === "toDay"}
        />
      )}

      {sheetEvent && (
        <EventDetailSheet
          key={sheetEvent.id}
          event={sheetEvent}
          calendars={calendars}
          open={openEventId !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) setOpenEventId(null);
          }}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}

      <CalendarListDrawer
        calendars={calendars}
        open={calendarListOpen}
        onOpenChange={setCalendarListOpen}
        onToggleCalendar={handleToggleCalendar}
        onEditCalendar={(id) => setEditingCalendarId(id)}
      />

      <CalendarEditDrawer
        key={editingCalendar?.id}
        calendar={editingCalendar}
        open={editingCalendarId !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingCalendarId(null);
        }}
        onSave={handleSaveCalendar}
      />
    </>
  );
}
