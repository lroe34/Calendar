import type { CalendarEvent, CalendarSource, Reminder } from "./types";

export const calendars: CalendarSource[] = [
  {
    id: "cal-tan",
    name: "Holidays in United States",
    color: "tan",
    accountName: "Gmail",
    subtitle: "Shared by Holidays in United States",
    visible: false,
  },
  {
    id: "cal-blue",
    name: "lroe34@gmail.com",
    color: "blue",
    accountName: "Gmail",
    visible: true,
  },
  {
    id: "cal-purple",
    name: "Family",
    color: "purple",
    accountName: "iCloud",
    subtitle: "Shared by Kelly Roe",
    visible: true,
  },
  {
    id: "cal-green",
    name: "Rockbot",
    color: "green",
    accountName: "iCloud",
    subtitle: "Public Calendar",
    visible: true,
  },
  {
    id: "cal-gray",
    name: "Shared",
    color: "gray",
    accountName: "iCloud",
    subtitle: "Shared by Kelly Roe",
    visible: true,
  },
  {
    id: "cal-slate",
    name: "Work",
    color: "slate",
    accountName: "iCloud",
    subtitle: "Public Calendar",
    visible: true,
  },
];

const CAL_IDS = calendars.map((c) => c.id);

/** Deterministic PRNG (mulberry32) so mock data is stable across server/client renders. */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(year: number, month: number, day: number, hour = 0, minute = 0): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
}

function isoDate(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

const explicitEvents: CalendarEvent[] = [
  {
    id: "ev-ooo",
    calendarId: "cal-green",
    title: "OOO",
    start: isoDate(2026, 6, 15),
    end: isoDate(2026, 6, 15),
    isAllDay: true,
  },
  {
    id: "ev-luke-nathan",
    calendarId: "cal-green",
    title: "Luke and Nathan 1:1",
    start: iso(2026, 6, 15, 10, 0),
    end: iso(2026, 6, 15, 10, 45),
    isAllDay: false,
    recurrence: { freq: "WEEKLY" },
  },
  {
    id: "ev-extern-1",
    calendarId: "cal-green",
    title: "[EXTERNAL] Vendor Sync",
    start: iso(2026, 6, 15, 10, 15),
    end: iso(2026, 6, 15, 11, 0),
    isAllDay: false,
    recurrence: { freq: "WEEKLY" },
  },
  {
    id: "ev-extern-2",
    calendarId: "cal-green",
    title: "[EXTERNAL] Design Review",
    start: iso(2026, 6, 15, 10, 15),
    end: iso(2026, 6, 15, 11, 0),
    isAllDay: false,
    recurrence: { freq: "WEEKLY" },
  },
  {
    id: "ev-rr-data",
    calendarId: "cal-green",
    title: "RR Data catch up",
    start: iso(2026, 6, 15, 11, 0),
    end: iso(2026, 6, 15, 12, 0),
    isAllDay: false,
    recurrence: { freq: "WEEKLY" },
  },
  {
    id: "ev-hinge",
    calendarId: "cal-blue",
    title: "Hinge Health Exercise Therapy Session",
    start: iso(2026, 6, 15, 16, 35),
    end: iso(2026, 6, 15, 17, 15),
    isAllDay: false,
  },
  {
    id: "ev-flight",
    calendarId: "cal-blue",
    title: "Flight: AA 1913 from ORD to IAH",
    start: iso(2026, 6, 15, 18, 27),
    end: iso(2026, 6, 15, 21, 14),
    isAllDay: false,
    location: {
      name: "O'Hare International Airport",
      address: "10000 W O'Hare Ave, Chicago, IL 60666, United States",
      kind: "flight",
    },
    source: { label: "Mail" },
    showAs: "busy",
  },
  {
    id: "ev-vacation",
    calendarId: "cal-purple",
    title: "Family Trip",
    start: isoDate(2026, 6, 17),
    end: isoDate(2026, 6, 18),
    isAllDay: true,
  },
];

export const reminders: Reminder[] = [
  {
    id: "rem-bahrulla",
    title: "Send Bahrulla blogs",
    due: iso(2026, 6, 15, 0, 0),
    completed: false,
  },
];

/** Procedural filler so Month view has realistic variety (colors, +N overflow, multi-day bars). */
function generateFillerEvents(): CalendarEvent[] {
  const rand = mulberry32(20260715);
  const events: CalendarEvent[] = [];
  let idCounter = 0;

  for (let month = 5; month <= 7; month++) {
    const daysInMonth = new Date(2026, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      if (month === 6 && day === 15) continue; // keep the hand-authored day exact

      const count = Math.floor(rand() * 4); // 0-3 events that day
      for (let i = 0; i < count; i++) {
        const calendarId = CAL_IDS[Math.floor(rand() * CAL_IDS.length)];
        const span = rand() < 0.15 ? Math.floor(rand() * 3) + 1 : 0;
        const startHour = 8 + Math.floor(rand() * 10);
        events.push({
          id: `fill-${idCounter++}`,
          calendarId,
          title: "Busy",
          start: span > 0 ? isoDate(2026, month, day) : iso(2026, month, day, startHour, 0),
          end:
            span > 0
              ? isoDate(2026, month, Math.min(day + span, daysInMonth))
              : iso(2026, month, day, startHour + 1, 0),
          isAllDay: span > 0,
        });
      }
    }
  }

  return events;
}

export const events: CalendarEvent[] = [...explicitEvents, ...generateFillerEvents()];
