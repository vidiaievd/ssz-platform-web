"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { AvailabilityBlock, Weekday } from "../../types";

const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 — 20:00

type Lesson = {
  lessonId: string;
  groupName: string;
  day: Weekday;
  startHour: number;
  durationHours: number;
  lang: string;
  hasConflict?: boolean;
};

type WeeklyGridProps = {
  availabilityBlocks: AvailabilityBlock[];
  lessons?: Lesson[];
};

function timeToHour(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h + m / 60;
}

export function WeeklyGrid({ availabilityBlocks, lessons = [] }: WeeklyGridProps) {
  const t = useTranslations("Teachers.schedule");
  const tAvail = useTranslations("Teachers.availability");

  // [rowIndex, colIndex] — 0-indexed into HOURS and WEEKDAYS
  const [focused, setFocused] = useState<[number, number]>([0, 0]);

  const focusCell = useCallback(
    (row: number, col: number, container: HTMLElement) => {
      const next: [number, number] = [
        Math.max(0, Math.min(HOURS.length - 1, row)),
        Math.max(0, Math.min(WEEKDAYS.length - 1, col)),
      ];
      setFocused(next);
      const selector = `[data-row="${next[0]}"][data-col="${next[1]}"]`;
      const cell = container.querySelector<HTMLElement>(selector);
      cell?.focus();
    },
    [],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const [row, col] = focused;
    const container = e.currentTarget;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusCell(row + 1, col, container);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusCell(row - 1, col, container);
        break;
      case "ArrowRight":
        e.preventDefault();
        focusCell(row, col + 1, container);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusCell(row, col - 1, container);
        break;
      case "Home":
        e.preventDefault();
        focusCell(row, 0, container);
        break;
      case "End":
        e.preventDefault();
        focusCell(row, WEEKDAYS.length - 1, container);
        break;
    }
  }

  function availabilityType(day: Weekday, hour: number) {
    for (const b of availabilityBlocks) {
      if (b.dayOfWeek !== day) continue;
      const start = timeToHour(b.startTime);
      const end = timeToHour(b.endTime);
      if (hour >= start && hour < end) return b.type;
    }
    return null;
  }

  return (
    <div
      role="grid"
      aria-label={t("title")}
      aria-rowcount={HOURS.length}
      aria-colcount={WEEKDAYS.length}
      onKeyDown={handleKeyDown}
      className="overflow-x-auto rounded-xl border border-border"
    >
      <div className="min-w-[640px]">
        {/* Header row */}
        <div
          role="row"
          aria-rowindex={0}
          className="grid border-b border-border"
          style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)" }}
        >
          <div className="py-2 text-center text-xs text-(--ssz-text-muted)" aria-hidden="true" />
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              role="columnheader"
              aria-label={d}
              className="py-2 text-center text-xs font-semibold text-(--ssz-text-secondary) uppercase tracking-wide border-l border-border"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Hour rows */}
        {HOURS.map((hour, rowIdx) => (
          <div
            key={hour}
            role="row"
            aria-rowindex={rowIdx + 1}
            className="grid border-b border-border last:border-0"
            style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)" }}
          >
            {/* Hour label */}
            <div
              className="flex items-start justify-end pr-2 pt-1 text-[10px] text-(--ssz-text-muted) tabular-nums"
              aria-hidden="true"
            >
              {String(hour).padStart(2, "0")}:00
            </div>

            {/* Day cells */}
            {WEEKDAYS.map((day, colIdx) => {
              const avType = availabilityType(day, hour);
              const cellLessons = lessons.filter(
                (l) =>
                  l.day === day &&
                  l.startHour <= hour &&
                  l.startHour + l.durationHours > hour,
              );
              const isFocused = focused[0] === rowIdx && focused[1] === colIdx;
              const avLabel =
                avType === "preferred"
                  ? tAvail("preferred")
                  : avType === "available"
                    ? tAvail("available")
                    : avType === "unavailable"
                      ? tAvail("unavailable")
                      : undefined;

              const cellLabel = [
                `${day} ${String(hour).padStart(2, "0")}:00`,
                avLabel,
                ...cellLessons.map((l) => l.groupName),
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <div
                  key={day}
                  role="gridcell"
                  aria-colindex={colIdx + 1}
                  aria-label={cellLabel}
                  data-row={rowIdx}
                  data-col={colIdx}
                  tabIndex={isFocused ? 0 : -1}
                  onFocus={() => setFocused([rowIdx, colIdx])}
                  className={cn(
                    "relative border-l border-border min-h-[2.5rem] px-1 py-0.5",
                    "focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2",
                    avType === "preferred" && "bg-success-50 dark:bg-success-950/20",
                    avType === "available" && "bg-muted/30",
                    avType === "unavailable" && "bg-error-50/50 dark:bg-error-950/20",
                    avType === null && "bg-background",
                  )}
                >
                  {cellLessons.map((lesson) => (
                    <div
                      key={lesson.lessonId}
                      aria-hidden="true"
                      className={cn(
                        "rounded px-1 py-0.5 text-[10px] font-medium leading-tight",
                        lesson.hasConflict
                          ? "bg-error-200 text-error-800 dark:bg-error-800/40 dark:text-error-200"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      {lesson.groupName}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap gap-4 px-4 py-2 border-t border-border bg-muted/20 text-xs text-(--ssz-text-muted)"
        aria-hidden="true"
      >
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-success-50 border border-success-200 dark:bg-success-950/20" />
          {tAvail("preferred")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-muted/30 border border-border" />
          {tAvail("available")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-error-50/50 border border-error-100 dark:bg-error-950/20" />
          {tAvail("unavailable")}
        </span>
      </div>
    </div>
  );
}
