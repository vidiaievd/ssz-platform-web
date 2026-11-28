"use client";

import { useFormatter, useTranslations } from "next-intl";

import { LoadBar } from "@/components/shared/operations/load-bar";
import { KpiTile } from "@/components/shared/operations/kpi-tile";
import type { TeacherLoadRow } from "../../types";

type LoadBreakdownPanelProps = {
  teacher: TeacherLoadRow;
  dayPeakHours: number;
  consecPeak: number;
  softCost: number;
};

export function LoadBreakdownPanel({
  teacher,
  dayPeakHours,
  consecPeak,
  softCost,
}: LoadBreakdownPanelProps) {
  const t = useTranslations("Teachers.schedule");
  const tOps = useTranslations("Common.operations");
  const format = useFormatter();
  const oneDecimal = (n: number) => format.number(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <div
      className="rounded-xl border border-border bg-card p-4 space-y-4"
      aria-label={t("loadBreakdown")}
    >
      <h2 className="text-sm font-semibold text-(--ssz-text-primary)">{t("loadBreakdown")}</h2>

      {/* Visual load bar */}
      <div className="space-y-1.5">
        <LoadBar
          contact={teacher.contactHours}
          cap={teacher.maxWeeklyContactHours}
          prep={teacher.prepHours}
        />
        <div className="flex justify-between text-xs text-(--ssz-text-muted)">
          <span>{t("contact")}: {tOps("hoursValue", { hours: teacher.contactHours })}</span>
          <span>{t("prep")}: {tOps("hoursValue", { hours: teacher.prepHours })}</span>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-2">
        <KpiTile
          label={t("effective")}
          value={oneDecimal(teacher.effectiveLoad)}
          unit={tOps("hoursUnit")}
        />
        <KpiTile
          label={t("utilization")}
          value={teacher.utilizationPct}
          unit="%"
          tone={
            teacher.utilizationPct > 100
              ? "danger"
              : teacher.utilizationPct >= 85
                ? "warn"
                : "default"
          }
        />
        <KpiTile
          label={t("dayPeak")}
          value={oneDecimal(dayPeakHours)}
          unit={tOps("hoursUnit")}
          tone={dayPeakHours >= 6 ? "danger" : "default"}
        />
        <KpiTile
          label={t("consecPeak")}
          value={consecPeak}
          tone={consecPeak >= 4 ? "warn" : "default"}
        />
      </div>

      <div className="pt-1 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-(--ssz-text-muted)">{t("softCost")}</span>
          <span className="font-semibold tabular-nums text-(--ssz-text-primary)">
            {softCost.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
