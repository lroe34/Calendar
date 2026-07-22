"use client";

import { useEffect, useState } from "react";
import { minutesSinceMidnight } from "@/lib/date-utils";
import { useDayScale } from "./DayScaleContext";

const GUTTER_WIDTH_PX = 52;

export function CurrentTimeLine() {
  const { minutesToPx } = useDayScale();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const top = minutesToPx(minutesSinceMidnight(now));
  const hour = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12;
  const label = `${hour}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top }}>
      <div
        className="absolute -translate-y-1/2 rounded-full bg-red-500 px-1.5 py-[1px] text-[11px] font-semibold text-white"
        style={{ left: 4 }}
      >
        {label}
      </div>
      <div
        className="absolute h-px bg-red-500"
        style={{ left: GUTTER_WIDTH_PX, right: 0, top: 0 }}
      />
      <div
        className="absolute h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-red-500"
        style={{ left: GUTTER_WIDTH_PX - 3 }}
      />
    </div>
  );
}
