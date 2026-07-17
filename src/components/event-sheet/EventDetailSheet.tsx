"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import type { CalendarEvent, CalendarSource, ShowAs } from "@/lib/types";
import { CALENDAR_COLORS } from "@/lib/colors";
import {
  formatEventTimeRangeSpaced,
  formatFullDate,
  toDateInputValue,
  toTimeInputValue,
} from "@/lib/date-utils";
import {
  CalendarGridIcon,
  CheckIcon,
  ChevronUpDownIcon,
  CloseIcon,
  HandRaisedIcon,
  PeopleIcon,
  PlusCircleIcon,
  RepeatIcon,
  SmallCalendarIcon,
} from "@/components/shared/Icons";
import { ToggleSwitch } from "@/components/shared/ToggleSwitch";
import { SourceCard } from "./SourceCard";
import { LocationCard } from "./LocationCard";
import { MiniDayPreview } from "./MiniDayPreview";

interface EventDetailSheetProps {
  event: CalendarEvent;
  calendars: CalendarSource[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: CalendarEvent) => void;
  onDelete: (id: string) => void;
}

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

function Divider() {
  return <div className="ml-11 border-t border-black/[.06] dark:border-white/[.08]" />;
}

function PickerRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-black/60 dark:text-white/60">
        {icon}
      </span>
      <span className="flex-1 text-[17px]">{label}</span>
      {children}
    </div>
  );
}

export function EventDetailSheet({
  event,
  calendars,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: EventDetailSheetProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<CalendarEvent>(event);

  // Re-sync whenever the sheet (re)opens, so a stale edit draft never leaks
  // into the next open of the same event. Done during render (React's
  // sanctioned "adjust state while rendering" pattern) rather than via an
  // effect, by tracking the previous `open` value alongside it.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(event);
      setMode("view");
    }
  }

  const liveCalendar = calendars.find((c) => c.id === draft.calendarId) ?? calendars[0];
  const color = CALENDAR_COLORS[liveCalendar.color];
  const start = new Date(draft.start);
  const end = new Date(draft.end);

  function patch(fields: Partial<CalendarEvent>) {
    setDraft((d) => ({ ...d, ...fields }));
  }

  /** Calendar/Show As apply immediately regardless of view/edit mode, matching the reference. */
  function patchAndSaveImmediately(fields: Partial<CalendarEvent>) {
    const updated = { ...draft, ...fields };
    setDraft(updated);
    onSave(updated);
  }

  function handleStartDateChange(value: string) {
    const [y, m, d] = value.split("-").map(Number);
    const next = new Date(start);
    next.setFullYear(y, m - 1, d);
    patch({ start: next.toISOString() });
  }
  function handleStartTimeChange(value: string) {
    const [h, min] = value.split(":").map(Number);
    const next = new Date(start);
    next.setHours(h, min);
    patch({ start: next.toISOString() });
  }
  function handleEndDateChange(value: string) {
    const [y, m, d] = value.split("-").map(Number);
    const next = new Date(end);
    next.setFullYear(y, m - 1, d);
    patch({ end: next.toISOString() });
  }
  function handleEndTimeChange(value: string) {
    const [h, min] = value.split(":").map(Number);
    const next = new Date(end);
    next.setHours(h, min);
    patch({ end: next.toISOString() });
  }

  function handleCancelEdit() {
    setDraft(event);
    setMode("view");
  }

  function handleSaveEdit() {
    onSave(draft);
    setMode("view");
  }

  function handleDelete() {
    if (window.confirm(`Delete "${draft.title}"? This can't be undone.`)) {
      onDelete(draft.id);
      onOpenChange(false);
    }
  }

  const hasLocationSection = mode === "edit" || draft.location || draft.source;
  const hasInvitees = mode === "edit" || (draft.attendees && draft.attendees.length > 0);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={mode === "view"}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[92%] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[#f2f2f5] outline-none dark:bg-[#1c1c1e]"
          aria-describedby={undefined}
        >
          <Drawer.Title className="sr-only">{draft.title}</Drawer.Title>

          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <button
              onClick={mode === "edit" ? handleCancelEdit : () => onOpenChange(false)}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black dark:bg-white/10 dark:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
            {mode === "view" ? (
              <button
                onClick={() => setMode("edit")}
                className="rounded-full bg-black/[.06] px-4 py-2 text-[16px] font-medium dark:bg-white/10"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={handleSaveEdit}
                aria-label="Save"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[.08] dark:bg-white/15"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-32">
            {mode === "view" ? (
              <div className="flex gap-3 pb-2 pt-2">
                <div className="w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: color.accent }} />
                <div>
                  <h1 className="text-[28px] font-bold leading-tight">{draft.title}</h1>
                  <div className="mt-2 text-[19px] leading-snug">{formatFullDate(start)}</div>
                  <div className="text-[19px] leading-snug">{formatEventTimeRangeSpaced(start, end)}</div>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 pb-2 pt-2">
                <div className="w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: color.accent }} />
                <div className="flex flex-1 flex-col gap-2.5">
                  <input
                    value={draft.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    className="w-full truncate rounded-2xl bg-white px-4 py-3 text-[19px] font-bold outline-none dark:bg-white/10"
                  />
                  <div className="flex flex-col rounded-2xl bg-white dark:bg-white/10">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="w-14 shrink-0 text-[17px] text-black/50 dark:text-white/50">Starts</span>
                      <div className="flex flex-1 justify-end gap-2">
                        <input
                          type="date"
                          value={toDateInputValue(start)}
                          onChange={(e) => handleStartDateChange(e.target.value)}
                          className="rounded-full bg-black/[.06] px-3 py-1.5 text-[15px] dark:bg-white/10"
                        />
                        {!draft.isAllDay && (
                          <input
                            type="time"
                            value={toTimeInputValue(start)}
                            onChange={(e) => handleStartTimeChange(e.target.value)}
                            className="rounded-full bg-black/[.06] px-3 py-1.5 text-[15px] dark:bg-white/10"
                          />
                        )}
                      </div>
                    </div>
                    <Divider />
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="w-14 shrink-0 text-[17px] text-black/50 dark:text-white/50">Ends</span>
                      <div className="flex flex-1 justify-end gap-2">
                        <input
                          type="date"
                          value={toDateInputValue(end)}
                          onChange={(e) => handleEndDateChange(e.target.value)}
                          className="rounded-full bg-black/[.06] px-3 py-1.5 text-[15px] dark:bg-white/10"
                        />
                        {!draft.isAllDay && (
                          <input
                            type="time"
                            value={toTimeInputValue(end)}
                            onChange={(e) => handleEndTimeChange(e.target.value)}
                            className="rounded-full bg-black/[.06] px-3 py-1.5 text-[15px] dark:bg-white/10"
                          />
                        )}
                      </div>
                    </div>
                    <Divider />
                    <PickerRow icon={<SmallCalendarIcon className="h-5 w-5" />} label="All-day">
                      <ToggleSwitch checked={draft.isAllDay} onChange={(v) => patch({ isAllDay: v })} />
                    </PickerRow>
                    <Divider />
                    <PickerRow icon={<RepeatIcon className="h-5 w-5" />} label="Repeat">
                      <div className="flex items-center gap-1 text-[16px] text-black/50 dark:text-white/50">
                        <select
                          value={draft.recurrence?.freq ?? "NEVER"}
                          onChange={(e) =>
                            patch({
                              recurrence:
                                e.target.value === "NEVER"
                                  ? undefined
                                  : { freq: e.target.value as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" },
                            })
                          }
                          className="appearance-none bg-transparent text-right outline-none"
                        >
                          <option value="NEVER">Never</option>
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                          <option value="YEARLY">Yearly</option>
                        </select>
                        <ChevronUpDownIcon className="h-3.5 w-3.5" />
                      </div>
                    </PickerRow>
                  </div>
                </div>
              </div>
            )}

            {hasLocationSection && (
              <Section title="Location">
                {mode === "view" && draft.source && <SourceCard source={draft.source} />}
                {draft.location && (
                  <LocationCard
                    location={draft.location}
                    editing={mode === "edit"}
                    onRemove={() => patch({ location: undefined })}
                  />
                )}
                {mode === "edit" && (
                  <button
                    onClick={() => patch({ videoCallUrl: draft.videoCallUrl ?? "" })}
                    className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[17px] text-black/40 dark:bg-white/10 dark:text-white/40"
                  >
                    <PlusCircleIcon className="h-5 w-5" />
                    {draft.videoCallUrl !== undefined ? (
                      <input
                        autoFocus
                        value={draft.videoCallUrl}
                        onChange={(e) => patch({ videoCallUrl: e.target.value })}
                        placeholder="Video Call or Conference"
                        className="flex-1 bg-transparent text-black outline-none dark:text-white"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      "Video Call or Conference"
                    )}
                  </button>
                )}
              </Section>
            )}

            {mode === "view" && draft.location && (
              <div className="mt-4">
                <MiniDayPreview event={draft} colorName={liveCalendar.color} />
              </div>
            )}

            {hasInvitees && (
              <Section title="Invitees">
                {mode === "edit" && !(draft.attendees && draft.attendees.length > 0) ? (
                  <button
                    onClick={() => patch({ attendees: [] })}
                    className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[17px] text-black/40 dark:bg-white/10 dark:text-white/40"
                  >
                    <PeopleIcon className="h-5 w-5" />
                    Invitees
                  </button>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[17px] dark:bg-white/10">
                    <PeopleIcon className="h-5 w-5 text-black/60 dark:text-white/60" />
                    {mode === "edit" ? (
                      <input
                        autoFocus
                        value={(draft.attendees ?? []).join(", ")}
                        onChange={(e) =>
                          patch({ attendees: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                        }
                        placeholder="Add invitees"
                        className="flex-1 bg-transparent outline-none"
                      />
                    ) : (
                      <span>{(draft.attendees ?? []).join(", ")}</span>
                    )}
                  </div>
                )}
              </Section>
            )}

            <Section title="Options">
              <div className="flex flex-col rounded-2xl bg-white dark:bg-white/10">
                <PickerRow icon={<CalendarGridIcon className="h-5 w-5" />} label="Calendar">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: CALENDAR_COLORS[liveCalendar.color].accent }}
                    />
                    <select
                      value={draft.calendarId}
                      onChange={(e) => patchAndSaveImmediately({ calendarId: e.target.value })}
                      className="appearance-none bg-transparent text-[16px] text-black/70 outline-none dark:text-white/70"
                    >
                      {calendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronUpDownIcon className="h-3.5 w-3.5 text-black/40 dark:text-white/40" />
                  </div>
                </PickerRow>
                <Divider />
                <PickerRow icon={<HandRaisedIcon className="h-5 w-5" />} label="Show As">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={draft.showAs ?? "busy"}
                      onChange={(e) => patchAndSaveImmediately({ showAs: e.target.value as ShowAs })}
                      className="appearance-none bg-transparent text-[16px] capitalize text-black/70 outline-none dark:text-white/70"
                    >
                      <option value="busy">Busy</option>
                      <option value="free">Free</option>
                      <option value="tentative">Tentative</option>
                    </select>
                    <ChevronUpDownIcon className="h-3.5 w-3.5 text-black/40 dark:text-white/40" />
                  </div>
                </PickerRow>
              </div>
            </Section>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <button
              onClick={handleDelete}
              className="pointer-events-auto rounded-full bg-white px-6 py-3 text-[16px] font-medium text-red-500 shadow-md dark:bg-[#2c2c2e]"
            >
              Delete Event
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
