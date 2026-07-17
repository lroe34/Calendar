"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import type { CalendarColorName, CalendarSource } from "@/lib/types";
import { CALENDAR_COLORS } from "@/lib/colors";
import { CheckIcon, ChevronRightIcon, CloseIcon } from "@/components/shared/Icons";
import { ToggleSwitch } from "@/components/shared/ToggleSwitch";

interface CalendarEditDrawerProps {
  calendar: CalendarSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: CalendarSource) => void;
}

const COLOR_NAMES: Record<CalendarColorName, string> = {
  green: "Green",
  blue: "Blue",
  gray: "Gray",
  tan: "Tan",
  purple: "Purple",
  slate: "Slate",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        {title}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function CalendarEditDrawer({ calendar, open, onOpenChange, onSave }: CalendarEditDrawerProps) {
  const [draft, setDraft] = useState<CalendarSource | null>(calendar);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  // Re-sync whenever the drawer (re)opens, so a stale draft from the
  // previously edited calendar never leaks into the next open. Done during
  // render (React's sanctioned "adjust state while rendering" pattern)
  // rather than via an effect, by tracking the previous `open` value.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(calendar);
      setColorPickerOpen(false);
    }
  }

  if (!draft) return null;

  function patch(fields: Partial<CalendarSource>) {
    setDraft((d) => (d ? { ...d, ...fields } : d));
  }

  function handleSave() {
    if (draft) onSave(draft);
    onOpenChange(false);
  }

  const color = CALENDAR_COLORS[draft.color];

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/30" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex h-[85%] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[#f2f2f5] outline-none dark:bg-[#1c1c1e]"
          aria-describedby={undefined}
        >
          <Drawer.Title className="sr-only">Edit Calendar</Drawer.Title>

          <div className="relative flex items-center justify-center px-4 pb-2 pt-4">
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Cancel"
              className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black dark:bg-white/10 dark:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
            <h1 className="text-[17px] font-semibold">Edit Calendar</h1>
            <button
              onClick={handleSave}
              aria-label="Save"
              className="absolute right-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/[.08] dark:bg-white/15"
            >
              <CheckIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8">
            <div className="mt-4">
              <input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                className="w-full rounded-2xl bg-white px-4 py-3 text-[17px] outline-none dark:bg-white/10"
              />
            </div>

            <Section title="Color">
              <div className="flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-white/10">
                <button
                  onClick={() => setColorPickerOpen((v) => !v)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: color.accent }} />
                  <span className="flex-1 text-[17px]">{COLOR_NAMES[draft.color]}</span>
                  <ChevronRightIcon
                    className={`h-4 w-4 text-black/30 transition-transform dark:text-white/30 ${
                      colorPickerOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {colorPickerOpen && (
                  <>
                    <div className="border-t border-black/[.06] dark:border-white/[.08]" />
                    <div className="flex flex-wrap gap-3 px-4 py-3">
                      {(Object.keys(CALENDAR_COLORS) as CalendarColorName[]).map((name) => (
                        <button
                          key={name}
                          onClick={() => {
                            patch({ color: name });
                            setColorPickerOpen(false);
                          }}
                          aria-label={COLOR_NAMES[name]}
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{ backgroundColor: CALENDAR_COLORS[name].accent }}
                        >
                          {draft.color === name && <CheckIcon className="h-4 w-4 text-white" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Section>

            <Section title="Notifications">
              <div className="rounded-2xl bg-white dark:bg-white/10">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-[17px]">Event Alerts</span>
                  <ToggleSwitch checked={draft.eventAlerts ?? true} onChange={(v) => patch({ eventAlerts: v })} />
                </div>
              </div>
              <div className="px-1 text-[13px] text-black/40 dark:text-white/40">
                Allow events on this calendar to display alerts.
              </div>
            </Section>

            <Section title="Availability">
              <div className="rounded-2xl bg-white dark:bg-white/10">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-[17px]">Events Affect Availability</span>
                  <ToggleSwitch
                    checked={draft.eventsAffectAvailability ?? true}
                    onChange={(v) => patch({ eventsAffectAvailability: v })}
                  />
                </div>
              </div>
              <div className="px-1 text-[13px] text-black/40 dark:text-white/40">
                Events on this calendar will affect your availability for scheduling.
              </div>
            </Section>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
