"use client";

import { useState } from "react";
import { MonthView } from "@/components/month/MonthView";
import { DayView } from "@/components/day/DayView";
import { calendars, events, reminders } from "@/lib/mock-data";
import { startOfDay } from "@/lib/date-utils";

type View = "month" | "day";

export function CalendarApp() {
  const today = startOfDay(new Date());
  const [view, setView] = useState<View>("month");
  const [selectedDate, setSelectedDate] = useState(today);

  function handleSelectDate(date: Date) {
    setSelectedDate(startOfDay(date));
    setView("day");
  }

  if (view === "day") {
    return (
      <DayView
        today={today}
        selectedDate={selectedDate}
        events={events}
        reminders={reminders}
        calendars={calendars}
        onSelectDate={(date) => setSelectedDate(startOfDay(date))}
        onBack={() => setView("month")}
      />
    );
  }

  return (
    <MonthView
      today={today}
      anchorDate={selectedDate}
      events={events}
      calendars={calendars}
      onSelectDate={handleSelectDate}
    />
  );
}
