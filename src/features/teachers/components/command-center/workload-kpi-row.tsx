"use client";

import { useTranslations } from "next-intl";

import { KpiTile } from "@/components/shared/operations/kpi-tile";
import type { WorkloadKpis } from "../../types";

type WorkloadKpiRowProps = {
  kpis: WorkloadKpis;
};

export function WorkloadKpiRow({ kpis }: WorkloadKpiRowProps) {
  const t = useTranslations("Teachers.commandCenter.kpis");

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <KpiTile
        label={t("utilization")}
        value={kpis.utilizationAvgPct}
        unit="%"
        tone={
          kpis.utilizationAvgPct > 100 ? "danger"
            : kpis.utilizationAvgPct >= 85 ? "warn"
              : "default"
        }
      />
      <KpiTile
        label={t("spareCapacity")}
        value={kpis.spareCapacityHours.toFixed(1)}
        unit="h"
        tone={kpis.spareCapacityHours <= 0 ? "danger" : "default"}
      />
      <KpiTile
        label={t("overloaded")}
        value={kpis.overloadedCount}
        tone={kpis.overloadedCount > 0 ? "danger" : "success"}
      />
      <KpiTile
        label={t("clashes")}
        value={kpis.clashCount}
        tone={kpis.clashCount > 0 ? "danger" : "success"}
      />
      <KpiTile
        label={t("vacancies")}
        value={kpis.vacancyCount}
        tone={kpis.vacancyCount > 0 ? "warn" : "success"}
      />
    </div>
  );
}
