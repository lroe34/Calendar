import type { CSSProperties } from "react";

interface IconProps {
  className?: string;
  style?: CSSProperties;
}

export function ChevronLeftIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path
        d="M15 5l-7 7 7 7"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx={11} cy={11} r={7} stroke="currentColor" strokeWidth={2} />
      <path
        d="M21 21l-4.3-4.3"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlusIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ViewSwitcherIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <rect x={4} y={6} width={16} height={3.2} rx={1.4} fill="currentColor" />
      <rect x={4} y={10.4} width={16} height={3.2} rx={1.4} fill="currentColor" />
      <rect x={4} y={14.8} width={16} height={3.2} rx={1.4} fill="currentColor" />
    </svg>
  );
}

export function CalendarGridIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <rect x={4} y={5} width={16} height={15} rx={2.5} stroke="currentColor" strokeWidth={1.8} />
      <path d="M4 9.5h16" stroke="currentColor" strokeWidth={1.8} />
      <path d="M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

export function InboxIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path
        d="M4 13l1.6-6.4A2 2 0 0 1 7.5 5h9a2 2 0 0 1 1.9 1.6L20 13"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <path
        d="M4 13h4.5l1 2h5l1-2H20v4.5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5V13Z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RepeatIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path
        d="M17 2l3 3-3 3M7 22l-3-3 3-3"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 5H9a5 5 0 0 0-5 5v1M4 19h11a5 5 0 0 0 5-5v-1"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PinIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path
        d="M12 22s7-7.4 7-12.5A7 7 0 0 0 5 9.5C5 14.6 12 22 12 22Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <circle cx={12} cy={9.5} r={2.4} stroke="currentColor" strokeWidth={1.6} />
    </svg>
  );
}

export function ClockIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx={12} cy={12} r={8.5} stroke="currentColor" strokeWidth={1.6} />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SmallCalendarIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <rect x={3.5} y={4.5} width={17} height={16} rx={3} fill="currentColor" />
      <rect x={6.5} y={8} width={11} height={2} rx={1} fill="white" fillOpacity={0.85} />
      <rect x={6.5} y={12} width={11} height={2} rx={1} fill="white" fillOpacity={0.55} />
    </svg>
  );
}

export function ReminderCircleIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <circle cx={12} cy={12} r={8.5} stroke="currentColor" strokeWidth={1.8} />
    </svg>
  );
}
