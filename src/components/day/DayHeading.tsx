import { formatDayHeading, getWeekLabel } from "@/lib/date-utils";

interface DayHeadingProps {
  date: Date;
}

export function DayHeading({ date }: DayHeadingProps) {
  return (
    <div className="flex items-baseline gap-3  px-4 py-2 border-t border-black/[.06] dark:border-white/[.08]">
      <span className="text-[12px] text-black/40 dark:text-white/40">W{getWeekLabel(date)}</span>
      <span className="text-[17px] font-bold">{formatDayHeading(date)}</span>
    </div>
  );
}
