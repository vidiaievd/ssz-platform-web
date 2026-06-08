"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { KpiTile } from "@/components/shared/operations/kpi-tile";
import { forecast as computeForecast } from "@/lib/groups/operations";
import { useForecastScenarioStore } from "../../stores/forecast-scenario-store";
import type { ForecastBaseline, ForecastParams } from "../../types";
import { AssumptionSliders } from "./assumption-sliders";
import { ProjectionChart } from "./projection-chart";
import { LanguageGapTable } from "./language-gap-table";
import { BottleneckCallout } from "./bottleneck-callout";
import { SaveScenarioBar } from "./save-scenario-bar";

const DEBOUNCE_MS = 300;

type ForecastDashboardClientProps = {
  schoolId: string;
  baseline: ForecastBaseline;
};

export function ForecastDashboardClient({ schoolId, baseline }: ForecastDashboardClientProps) {
  const t = useTranslations("Teachers.forecast");
  const { params, result, setParams, setResult } = useForecastScenarioStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute initial forecast on mount
  useEffect(() => {
    const r = computeForecast(params, baseline);
    setResult(r);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleParamChange(newParams: ForecastParams) {
    setParams(newParams);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const r = computeForecast(newParams, baseline);
      setResult(r);
    }, DEBOUNCE_MS);
  }

  return (
    <main className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-(--ssz-text-primary)">{t("title")}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Left: sliders + headline */}
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <AssumptionSliders
              params={params}
              onChange={handleParamChange}
            />
          </div>
          {result && (
            <KpiTile
              label={t("headline")}
              value={result.hireGap}
              tone={result.hireGap > 0 ? "danger" : "success"}
            />
          )}
        </div>

        {/* Right: chart + gaps + bottleneck + save */}
        <div className="space-y-5">
          {result && (
            <>
              <ProjectionChart projection={result.projection} />
              <LanguageGapTable perLanguage={result.perLanguage} />
              <BottleneckCallout bottleneck={result.bottleneck} />
              <SaveScenarioBar params={params} result={result} schoolId={schoolId} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
