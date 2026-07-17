"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import type { CalendarSource } from "@/lib/types";
import { CALENDAR_COLORS } from "@/lib/colors";
import { CheckIcon, ChevronDownIcon, CloseIcon, InfoIcon } from "@/components/shared/Icons";

interface CalendarListDrawerProps {
  calendars: CalendarSource[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleCalendar: (id: string) => void;
  onEditCalendar: (id: string) => void;
}

function groupByAccount(calendars: CalendarSource[]): [string, CalendarSource[]][] {
  const order: string[] = [];
  const groups = new Map<string, CalendarSource[]>();
  for (const cal of calendars) {
    if (!groups.has(cal.accountName)) {
      groups.set(cal.accountName, []);
      order.push(cal.accountName);
    }
    groups.get(cal.accountName)!.push(cal);
  }
  return order.map((name) => [name, groups.get(name)!]);
}

export function CalendarListDrawer({
  calendars,
  open,
  onOpenChange,
  onToggleCalendar,
  onEditCalendar,
}: CalendarListDrawerProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const groups = groupByAccount(calendars);

  function toggleGroup(name: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[85%] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[#f2f2f5] outline-none dark:bg-[#1c1c1e]"
          aria-describedby={undefined}
        >
          <Drawer.Title className="sr-only">Calendars</Drawer.Title>

          <div className="relative flex items-center justify-center px-4 pb-2 pt-4">
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black dark:bg-white/10 dark:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
            <h1 className="text-[17px] font-semibold">Calendars</h1>
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8">
            {groups.map(([accountName, group]) => {
              const isCollapsed = collapsedGroups.has(accountName);
              return (
                <div key={accountName} className="mt-5 first:mt-2">
                  <button
                    onClick={() => toggleGroup(accountName)}
                    className="flex w-full items-center justify-between px-1 pb-2 text-[15px] font-medium text-black/40 dark:text-white/40"
                  >
                    {accountName}
                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                    />
                  </button>
                  {!isCollapsed && (
                    <div className="flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-white/10">
                      {group.map((cal, i) => {
                        const color = CALENDAR_COLORS[cal.color];
                        return (
                          <div key={cal.id}>
                            {i > 0 && (
                              <div className="ml-[60px] border-t border-black/[.06] dark:border-white/[.08]" />
                            )}
                            <div className="flex items-center gap-3 px-4 py-3">
                              <button
                                onClick={() => onToggleCalendar(cal.id)}
                                aria-pressed={cal.visible}
                                aria-label={cal.visible ? `Hide ${cal.name}` : `Show ${cal.name}`}
                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              >
                                <span
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                                  style={
                                    cal.visible
                                      ? { backgroundColor: color.accent }
                                      : { border: `2px solid ${color.accent}` }
                                  }
                                >
                                  {cal.visible && <CheckIcon className="h-3.5 w-3.5 text-white" />}
                                </span>
                                <span className="min-w-0">
                                  <div className="truncate text-[17px] leading-tight">{cal.name}</div>
                                  {cal.subtitle && (
                                    <div className="truncate text-[13px] leading-tight text-black/40 dark:text-white/40">
                                      {cal.subtitle}
                                    </div>
                                  )}
                                </span>
                              </button>
                              <button
                                onClick={() => onEditCalendar(cal.id)}
                                aria-label={`Edit ${cal.name}`}
                                className="flex h-7 w-7 shrink-0 items-center justify-center text-red-500"
                              >
                                <InfoIcon className="h-6 w-6" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
