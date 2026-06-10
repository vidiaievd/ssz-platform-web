"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LanguageChip } from "@/components/shared/operations/language-chip";
import type { SubstituteRequest, SubRequestUrgency } from "../../types";

type CoverQueueRailProps = {
  requests: SubstituteRequest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const URGENCY_ORDER: SubRequestUrgency[] = ["today", "upcoming", "open"];

function urgencyIndex(u: SubRequestUrgency) {
  return URGENCY_ORDER.indexOf(u);
}

export function CoverQueueRail({ requests, selectedId, onSelect }: CoverQueueRailProps) {
  const t = useTranslations("Teachers.substitutions");

  const sorted = [...requests].sort(
    (a, b) => urgencyIndex(a.urgency) - urgencyIndex(b.urgency),
  );

  if (sorted.length === 0) {
    return (
      <div className="p-4 text-sm text-(--ssz-text-muted)">{t("empty")}</div>
    );
  }

  return (
    <ul
      role="listbox"
      aria-label={t("title")}
      className="overflow-y-auto divide-y divide-border"
    >
      {sorted.map((req) => {
        const isSelected = req.requestId === selectedId;
        return (
          <li
            key={req.requestId}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
            onClick={() => onSelect(req.requestId)}
            onKeyDown={(e) => e.key === "Enter" && onSelect(req.requestId)}
            className={cn(
              "px-3 py-3 cursor-pointer transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              isSelected
                ? "bg-primary/10 border-l-2 border-primary"
                : "hover:bg-accent/50 border-l-2 border-transparent",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-(--ssz-text-primary) truncate">
                  {req.groupName}
                </p>
                <p className="text-xs text-(--ssz-text-muted) mt-0.5">
                  {req.day} {req.start}–{req.end}
                </p>
              </div>
              <LanguageChip lang={req.lang} className="shrink-0" />
            </div>
            <div className="mt-1.5">
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  req.urgency === "today"
                    ? "bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400"
                    : req.urgency === "upcoming"
                      ? "bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-400"
                      : "bg-muted text-(--ssz-text-muted)",
                )}
              >
                {req.urgency === "today" && t("urgencyToday")}
                {req.urgency === "upcoming" && t("urgencyUpcoming")}
                {req.urgency === "open" && t("urgencyOpen")}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
