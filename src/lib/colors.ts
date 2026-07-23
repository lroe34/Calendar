import type { CalendarColorName } from "./types";

interface ColorTokens {
  /** Solid accent used for month-view bars and the day-view left accent strip */
  accent: string;
  /** Pale tint used for day-view block fill */
  tint: string;
  /** Text color for content drawn on top of the tint fill */
  text: string;
}

export const CALENDAR_COLORS: Record<CalendarColorName, ColorTokens> = {
  green: { accent: "#63b76c", tint: "#e3f2e2", text: "#2f5e34" },
  blue: { accent: "#4f9bf0", tint: "#dcebfc", text: "#1f5590" },
  gray: { accent: "#9a9a9e", tint: "#e9e9eb", text: "#55555a" },
  tan: { accent: "#c9a877", tint: "#f2e9d8", text: "#7a5f34" },
  purple: { accent: "#a68ee0", tint: "#ece5f9", text: "#5c4693" },
  slate: { accent: "#5b6b8c", tint: "#e2e6ee", text: "#333f57" },
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
