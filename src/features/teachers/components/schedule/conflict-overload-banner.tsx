"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { HealthState } from "../../types";

type ConflictOverloadBannerProps = {
  healthState: HealthState;
  conflictCount: number;
  utilizationPct: number;
  dayPeakHours: number;
  consecPeak: number;
};

export function ConflictOverloadBanner({
  healthState,
  conflictCount,
  utilizationPct,
  dayPeakHours,
  consecPeak,
}: ConflictOverloadBannerProps) {
  const t = useTranslations("Teachers.schedule");

  if (healthState === "ok" && conflictCount === 0) return null;

  const isDanger = healthState === "danger" || conflictCount > 0;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3",
        isDanger
          ? "border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-950/30"
          : "border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-950/30",
      )}
    >
      {isDanger ? (
        <XCircle className="mt-0.5 size-5 shrink-0 text-error-500" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-500" aria-hidden="true" />
      )}
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-(--ssz-text-primary)">
          {isDanger ? t("overloadTitle") : t("nearCapTitle")}
        </p>
        <ul className="space-y-0.5 text-xs text-(--ssz-text-secondary)">
          {conflictCount > 0 && (
            <li>{t("conflicts", { count: conflictCount })}</li>
          )}
          {utilizationPct >= 85 && (
            <li>{t("utilizationWarning", { pct: utilizationPct })}</li>
          )}
          {dayPeakHours >= 6 && (
            <li>{t("dayPeakWarning", { hours: dayPeakHours })}</li>
          )}
          {consecPeak >= 4 && (
            <li>{t("consecPeakWarning", { count: consecPeak })}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
