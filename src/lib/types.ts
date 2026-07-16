export type CalendarColorName =
  | "green"
  | "blue"
  | "gray"
  | "tan"
  | "purple"
  | "slate";

export interface CalendarSource {
  id: string;
  name: string;
  color: CalendarColorName;
}

export interface RecurrenceRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval?: number;
  byDay?: string[];
  until?: string;
}

export interface EventLocation {
  name: string;
  address?: string;
  /** Airport/travel-style pin glyph vs. a plain generic map pin. */
  kind?: "generic" | "flight";
}

/** Where this event came from — omitted entirely for manually-created events. */
export interface EventSource {
  label: string;
}

export type ShowAs = "busy" | "free" | "tentative";

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  /** ISO 8601 datetime (or date-only for all-day events) */
  start: string;
  /** ISO 8601 datetime (or date-only for all-day events) */
  end: string;
  isAllDay: boolean;
  location?: EventLocation;
  recurrence?: RecurrenceRule;
  source?: EventSource;
  showAs?: ShowAs;
  videoCallUrl?: string;
  attendees?: string[];
}

export interface Reminder {
  id: string;
  title: string;
  /** ISO 8601 datetime; undefined if no due date */
  due?: string;
  completed: boolean;
}
