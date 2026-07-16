import type { EventSource } from "@/lib/types";

interface SourceCardProps {
  source: EventSource;
}

/** View-mode-only "this event came from X" card — omitted entirely when the event has no source. */
export function SourceCard({ source }: SourceCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-white/10">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <rect x={3} y={5.5} width={18} height={13} rx={2.5} fill="white" />
          <path d="M4 7l8 6 8-6" stroke="#3b82f6" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="flex-1 text-[17px]">{source.label}</span>
      <span className="rounded-full bg-green-100 px-3 py-1 text-[15px] font-medium text-black dark:bg-green-900/40 dark:text-white">
        Open
      </span>
      <button
        aria-label="Share"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[.05] dark:bg-white/10"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path
            d="M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
