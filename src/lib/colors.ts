import type { CalendarColorName } from "./types";

interface ColorTokens {
  /** Solid accent used for month-view bars and the day-view left accent strip */
  accent: string;
  /** Translucent accent used for event fills so the surface follows the theme */
  tint: string;
  /** Accent color for content drawn on top of the translucent fill */
  text: string;
}

function calendarColor(accent: string): ColorTokens {
  return {
    accent,
    tint: hexToRgba(accent, 0.18),
    text: accent,
  };
}

export const CALENDAR_COLORS: Record<CalendarColorName, ColorTokens> = {
  // Apple's light-appearance system colors. The translucent fill derived
  // above lets the same accents sit naturally on both light and dark surfaces.
  green: calendarColor("#34C759"),
  blue: calendarColor("#007AFF"),
  gray: calendarColor("#8E8E93"),
  tan: calendarColor("#A2845E"), // systemBrown
  purple: calendarColor("#AF52DE"),
  slate: calendarColor("#5856D6"), // systemIndigo
};

/** `#rrggbb` (or `#rgb`) plus an 0-1 alpha, as an `rgba(...)` string. */
export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
