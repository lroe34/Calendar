"use client";

import { useLayoutEffect, useRef } from "react";
import { BottomBar } from "@/components/shared/BottomBar";
import { PlusIcon, SearchIcon } from "@/components/shared/Icons";
import { MiniMonthCard } from "./MiniMonthCard";

interface YearViewProps {
  today: Date;
  anchorYear: number;
  onSelectMonth: (year: number, month: number) => void;
  onGridView?: () => void;
}

const YEARS_BEFORE = 1;
const YEARS_AFTER = 1;

export function YearView({ today, anchorYear, onSelectMonth, onGridView }: YearViewProps) {
  const years = Array.from(
    { length: YEARS_BEFORE + YEARS_AFTER + 1 },
    (_, i) => anchorYear - YEARS_BEFORE + i,
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const anchorIndex = years.indexOf(anchorYear);

  function scrollToIndex(index: number, smooth: boolean) {
    const container = scrollRef.current;
    const target = sectionRefs.current[index];
    if (!container || !target) return;
    container.scrollTo({ top: target.offsetTop, behavior: smooth ? "smooth" : "auto" });
  }

  useLayoutEffect(() => {
    scrollToIndex(anchorIndex, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToday() {
    const idx = years.indexOf(today.getFullYear());
    if (idx >= 0) scrollToIndex(idx, true);
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-white dark:bg-black">
      <div
        ref={scrollRef}
        className="no-scrollbar absolute inset-0 overflow-y-auto pb-28 pt-16"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 56px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 56px)",
        }}
      >
        {years.map((year, i) => {
          const isCurrentYear = year === today.getFullYear();
          return (
            <div
              key={year}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              className="px-4 pb-10"
            >
              <h1
                className={`mb-6 text-center text-[40px] font-bold leading-tight ${
                  isCurrentYear ? "text-red-500" : "text-black dark:text-white"
                }`}
              >
                {year}
              </h1>
              <div className="grid grid-cols-3 gap-x-4 gap-y-9">
                {Array.from({ length: 12 }, (_, month) => (
                  <MiniMonthCard key={month} year={year} month={month} today={today} onSelect={onSelectMonth} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-end px-4 pt-3">
        <div className="pointer-events-auto flex items-center gap-5 rounded-full bg-black/[.05] px-4 py-2 dark:bg-white/10">
          <button aria-label="Search" className="text-black dark:text-white">
            <SearchIcon className="h-5 w-5" />
          </button>
          <button aria-label="Add event" className="text-black dark:text-white">
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-40">
        <BottomBar onToday={handleToday} onGridView={onGridView} inboxBadge={1} />
      </div>
    </div>
  );
}
