"use client";

interface DecorativeMapProps {
  kind?: "generic" | "flight";
  /** Shown as a label overlay directly on the map — edit mode only. */
  label?: string;
  onRemove?: () => void;
  size?: number;
}

/**
 * A stylized, decorative stand-in for a real map tile (MapKit/Mapbox/etc are
 * out of scope here) — muted background, a few road lines, and a pin. Not a
 * functional interactive map.
 */
export function DecorativeMap({ kind = "generic", label, onRemove, size = 112 }: DecorativeMapProps) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-xl bg-[#dbe2e8]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 112 112" className="absolute inset-0 h-full w-full">
        <rect width={112} height={112} fill="#dde3e8" />
        <path d="M0 30 Q40 10 60 40 T112 35" stroke="#c7cfd6" strokeWidth={3} fill="none" />
        <path d="M0 75 Q50 60 70 85 T112 80" stroke="#c7cfd6" strokeWidth={3} fill="none" />
        <path d="M20 0 Q35 40 20 70 T30 112" stroke="#c7cfd6" strokeWidth={2.5} fill="none" />
        <path d="M85 0 Q70 50 90 70 T80 112" stroke="#c7cfd6" strokeWidth={2.5} fill="none" />
      </svg>

      <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 shadow-sm">
          {kind === "flight" ? (
            <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4">
              <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2.5 1.5V22l4-1 4 1v-1.5L13 19v-5.5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="white" className="h-4 w-4">
              <circle cx={12} cy={12} r={5} />
            </svg>
          )}
        </div>
        <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-blue-500" />
      </div>

      {label && (
        <div className="absolute inset-x-0 bottom-1.5 text-center text-[10px] font-medium leading-tight text-black/70">
          {label}
        </div>
      )}

      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remove location"
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
