"use client";

import { CalendarGridIcon, InboxIcon } from "./Icons";

interface BottomBarProps {
  onToday: () => void;
  onGridView?: () => void;
  onInbox?: () => void;
}

export function BottomBar({ onToday, onGridView, onInbox }: BottomBarProps) {
  return (
    <div className="pointer-events-none flex items-end justify-between px-4 pb-4 pt-6">
      <button
        onClick={onToday}
        className="pointer-events-auto rounded-full bg-white/70 px-5 py-2.5 text-[15px] font-medium text-black shadow-sm backdrop-blur-xl active:bg-white/90 dark:bg-black/60 dark:text-white"
      >
        Today
      </button>

      <div className="pointer-events-auto flex items-center gap-5 rounded-full bg-white/70 px-5 py-2.5 shadow-sm backdrop-blur-xl dark:bg-black/60">
        <button onClick={onGridView} aria-label="Calendar view" className="text-black dark:text-white">
          <CalendarGridIcon className="h-5 w-5" />
        </button>
        <button onClick={onInbox} aria-label="Inbox" className="text-black dark:text-white">
          <InboxIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
