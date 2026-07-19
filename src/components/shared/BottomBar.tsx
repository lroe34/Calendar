"use client";

import { CalendarGridIcon, InboxIcon } from "./Icons";

interface BottomBarProps {
  onToday: () => void;
  onGridView?: () => void;
  onInbox?: () => void;
  /** Unread count shown as a small red badge on the inbox icon; omitted when falsy. */
  inboxBadge?: number;
}

export function BottomBar({ onToday, onGridView, onInbox, inboxBadge }: BottomBarProps) {
  return (
    <div className="pointer-events-none flex items-end justify-between px-4 pb-4 pt-6">

      <button
        onClick={onToday}
        className="pointer-events-auto rounded-full bg-white/30 border-y-4 border-transparent px-5 py-2.5 text-[12px] font-medium text-black backdrop-blur-sm active:bg-white/10 dark:bg-black/40 dark:text-white"
      >
        Today
      </button>

      <div className="pointer-events-auto flex items-center gap-5 rounded-full bg-white/30 px-5 py-2.5 backdrop-blur-sm dark:bg-black/40">
        <button onClick={onGridView} aria-label="Calendar view" className="text-black dark:text-white">
          <CalendarGridIcon className="h-5 w-5" />
        </button>
        <button onClick={onInbox} aria-label="Inbox" className="relative text-black dark:text-white">
          <InboxIcon className="h-5 w-5" />
          {!!inboxBadge && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-[3px] text-[10px] font-semibold leading-none text-white">
              {inboxBadge}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
