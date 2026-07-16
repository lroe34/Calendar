import type { EventLocation } from "@/lib/types";
import { DecorativeMap } from "./DecorativeMap";

interface LocationCardProps {
  location: EventLocation;
  editing?: boolean;
  onRemove?: () => void;
}

export function LocationCard({ location, editing = false, onRemove }: LocationCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-white/10">
      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-semibold leading-snug">{location.name}</div>
        {location.address && (
          <div className="mt-0.5 text-[14px] leading-snug text-black/50 dark:text-white/50">
            {location.address}
          </div>
        )}
      </div>
      <DecorativeMap
        kind={location.kind}
        label={editing ? location.name : undefined}
        onRemove={editing ? onRemove : undefined}
      />
    </div>
  );
}
