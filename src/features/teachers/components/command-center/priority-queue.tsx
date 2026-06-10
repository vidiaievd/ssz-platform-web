"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Vacancy } from "../../types";

type Violation = {
  id: string;
  severity: "danger" | "warn";
  message: string;
  ctaLabel: string;
  onCta: () => void;
};

type PriorityQueueProps = {
  violations: Violation[];
  vacancies: Vacancy[];
};

export function PriorityQueue({ violations, vacancies }: PriorityQueueProps) {
  const t = useTranslations("Teachers.commandCenter.priorityQueue");

  const vacancyItems: Violation[] = vacancies.map((v) => ({
    id: `vacancy-${v.lang}-${v.groupId}`,
    severity: "warn" as const,
    message: t("vacancyMessage", { lang: v.lang, group: v.groupName }),
    ctaLabel: t("arrangeCover"),
    onCta: () => {},
  }));

  const all = [
    ...violations.filter((v) => v.severity === "danger"),
    ...violations.filter((v) => v.severity === "warn"),
    ...vacancyItems,
  ];

  if (all.length === 0) return null;

  return (
    <div role="region" aria-label={t("title")} className="space-y-2">
      <h3 className="text-xs font-semibold text-(--ssz-text-muted) uppercase tracking-wide">
        {t("title")}
      </h3>
      <ul className="space-y-1.5">
        {all.map((item) => (
          <li
            key={item.id}
            role="alert"
            aria-live="polite"
            className={cn(
              "flex items-start gap-3 rounded-lg border px-3 py-2.5",
              item.severity === "danger"
                ? "border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-950/30"
                : "border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-950/30",
            )}
          >
            {item.severity === "danger" ? (
              <XCircle
                className="mt-0.5 size-4 shrink-0 text-error-500"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-warning-500"
                aria-hidden="true"
              />
            )}
            <span className="flex-1 text-sm text-(--ssz-text-primary) leading-snug">
              {item.message}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={item.onCta}
              className={cn(
                "h-auto px-2 py-0.5 text-xs font-semibold shrink-0",
                item.severity === "danger"
                  ? "text-error-700 hover:bg-error-100 dark:text-error-400 dark:hover:bg-error-900/40"
                  : "text-warning-700 hover:bg-warning-100 dark:text-warning-400 dark:hover:bg-warning-900/40",
              )}
            >
              {item.ctaLabel}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
