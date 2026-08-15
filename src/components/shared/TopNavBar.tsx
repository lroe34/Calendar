"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronLeftIcon, ListViewIcon, MultiDayViewIcon, PlusIcon, SearchIcon, SingleDayViewIcon, ViewSwitcherIcon } from "./Icons";

export type CalendarViewMode = "single" | "multi" | "list";

interface TopNavBarProps {
  backLabel: string;
  onBack: () => void;
  onViewSwitcher?: () => void;
  viewMode?: CalendarViewMode;
  onViewModeChange?: (mode: CalendarViewMode) => void;
  onSearch?: () => void;
  onAdd?: () => void;
}

const VIEW_OPTIONS = [
  { mode: "single" as const, label: "Single Day", Icon: SingleDayViewIcon },
  { mode: "multi" as const, label: "Multi Day", Icon: MultiDayViewIcon },
  { mode: "list" as const, label: "List", Icon: ListViewIcon },
];

export function TopNavBar({ backLabel, onBack, onViewSwitcher, viewMode, onViewModeChange, onSearch, onAdd }: TopNavBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
      <button
        onClick={onBack}
        className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-black/[.05] px-3 py-1.5 text-[17px] font-normal text-blue-600 active:bg-black/[.1] dark:bg-white/10 dark:text-blue-400"
      >
        <ChevronLeftIcon className="h-5 w-5" />
        {backLabel}
      </button>

      <div ref={menuRef} className="pointer-events-auto relative flex items-center gap-5 rounded-full bg-black/[.05] px-4 py-2 dark:bg-white/10">
        <button
          onClick={() => {
            if (onViewModeChange) setMenuOpen((open) => !open);
            onViewSwitcher?.();
          }}
          aria-label="Switch calendar view"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="text-black dark:text-white"
        >
          {viewMode === "multi" ? <MultiDayViewIcon className="h-5 w-5" /> : viewMode === "list" ? <ListViewIcon className="h-5 w-5" /> : viewMode === "single" ? <SingleDayViewIcon className="h-5 w-5" /> : <ViewSwitcherIcon className="h-5 w-5" />}
        </button>
        {menuOpen && onViewModeChange && (
          <div role="menu" aria-label="Calendar view" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-[1.75rem] border border-black/10 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-neutral-900/95">
            {VIEW_OPTIONS.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                role="menuitemradio"
                aria-checked={viewMode === mode}
                onClick={() => { onViewModeChange(mode); setMenuOpen(false); }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[18px] active:bg-black/[.06] dark:active:bg-white/10"
              >
                <span className="flex h-6 w-6 items-center justify-center">{viewMode === mode && <CheckIcon className="h-5 w-5" />}</span>
                <Icon className="h-7 w-7" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        <button onClick={onSearch} aria-label="Search" className="text-black dark:text-white">
          <SearchIcon className="h-5 w-5" />
        </button>
        <button onClick={onAdd} aria-label="Add event" className="text-black dark:text-white">
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
