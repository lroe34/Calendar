import { WEEKDAY_LETTERS } from "@/lib/date-utils";

interface MonthWeekdayHeaderProps {
  highlightColumn: number | null;
}

export function MonthWeekdayHeader({ highlightColumn }: MonthWeekdayHeaderProps) {
  return (
    <div className="flex px-4 pb-2">
      <div className="w-5 shrink-0" />
      <div className="grid grow grid-cols-7">
        {WEEKDAY_LETTERS.map((letter, i) => (
          <div key={i} className="flex justify-center">
            <span
              className={
                highlightColumn === i
                  ? "rounded-full bg-red-500/15 px-2 py-0.5 text-[13px] font-medium text-red-500"
                  : "px-2 py-0.5 text-[13px] font-medium text-black/45 dark:text-white/45"
              }
            >
              {letter}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
