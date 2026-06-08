"use client";

import { useTranslations } from "next-intl";
import type { ForecastResult } from "../../types";

type ProjectionChartProps = {
  projection: ForecastResult["projection"];
};

export function ProjectionChart({ projection }: ProjectionChartProps) {
  const t = useTranslations("Teachers.forecast");

  if (!projection.length) return null;

  const maxNeeded = Math.max(...projection.map((p) => p.teachersNeeded), 1);

  return (
    <div
      className="space-y-2"
      role="img"
      aria-label={t("projectionChart")}
    >
      <h3 className="text-sm font-semibold text-(--ssz-text-primary)">{t("projectionChart")}</h3>
      <div className="flex items-end gap-1.5 h-32 px-1">
        {projection.map((p) => {
          const heightPct = (p.teachersNeeded / maxNeeded) * 100;
          return (
            <div
              key={p.term}
              className="flex-1 flex flex-col items-center gap-1 group relative"
            >
              <div className="relative flex-1 flex items-end w-full">
                <div
                  className="w-full rounded-t-sm bg-primary/80 hover:bg-primary transition-all"
                  style={{ height: `${heightPct}%`, minHeight: "2px" }}
                  aria-label={`Term ${p.term}: ${p.teachersNeeded} teachers`}
                />
              </div>
              {/* Tooltip */}
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10
                           invisible group-hover:visible opacity-0 group-hover:opacity-100
                           transition-opacity whitespace-nowrap
                           rounded bg-card border border-border shadow-md px-2 py-1 text-xs text-(--ssz-text-primary)"
              >
                T{p.term}: {p.teachersNeeded}
              </div>
              <span className="text-[9px] text-(--ssz-text-muted) tabular-nums">T{p.term}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
