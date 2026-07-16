"use client";

import { useState } from "react";
import { MonthView } from "@/components/month/MonthView";
import { DayView } from "@/components/day/DayView";
import { EventDetailSheet } from "@/components/event-sheet/EventDetailSheet";
import { calendars, events as initialEvents, reminders } from "@/lib/mock-data";
import { startOfDay } from "@/lib/date-utils";
import type { CalendarEvent } from "@/lib/types";

type View = "month" | "day";

export function CalendarApp() {
  const today = startOfDay(new Date());
  const [view, setView] = useState<View>("month");
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
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

  function handleSelectDate(date: Date) {
    setSelectedDate(startOfDay(date));
    setView("day");
  }

  function handleSaveEvent(updated: CalendarEvent) {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  function handleDeleteEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setOpenEventId(null);
  }

  return (
    <>
      {view === "day" ? (
        <DayView
          today={today}
          selectedDate={selectedDate}
          events={events}
          reminders={reminders}
          calendars={calendars}
          onSelectDate={(date) => setSelectedDate(startOfDay(date))}
          onBack={() => setView("month")}
          onSelectEvent={(event) => setOpenEventId(event.id)}
        />
      ) : (
        <MonthView
          today={today}
          anchorDate={selectedDate}
          events={events}
          calendars={calendars}
          onSelectDate={handleSelectDate}
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
    </>
  );
}
