"use client";

import { ChevronLeftIcon, PlusIcon, SearchIcon, ViewSwitcherIcon } from "./Icons";

interface TopNavBarProps {
  backLabel: string;
  onBack: () => void;
  onViewSwitcher?: () => void;
  onSearch?: () => void;
  onAdd?: () => void;
}

export function TopNavBar({ backLabel, onBack, onViewSwitcher, onSearch, onAdd }: TopNavBarProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
      <button
        onClick={onBack}
        className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-black/[.05] px-3 py-1.5 text-[17px] font-normal text-blue-600 active:bg-black/[.1] dark:bg-white/10 dark:text-blue-400"
      >
        <ChevronLeftIcon className="h-5 w-5" />
        {backLabel}
      </button>

      <div className="pointer-events-auto flex items-center gap-5 rounded-full bg-black/[.05] px-4 py-2 dark:bg-white/10">
        <button onClick={onViewSwitcher} aria-label="Switch view" className="text-black dark:text-white">
          <ViewSwitcherIcon className="h-5 w-5" />
        </button>
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
