"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LanguageChip } from "@/components/shared/operations/language-chip";
import { LoadBar } from "@/components/shared/operations/load-bar";
import type { ForecastResult } from "../../types";

type LanguageGapTableProps = {
  perLanguage: ForecastResult["perLanguage"];
};

type SortKey = "lang" | "gap" | "util" | "risk";

const RISK_ORDER: Record<string, number> = { high: 2, medium: 1, low: 0 };

export function LanguageGapTable({ perLanguage }: LanguageGapTableProps) {
  const t = useTranslations("Teachers.forecast");
  const [sortKey, setSortKey] = useState<SortKey>("util");

  const sorted = [...perLanguage].sort((a, b) => {
    if (sortKey === "risk") return (RISK_ORDER[b.risk] ?? 0) - (RISK_ORDER[a.risk] ?? 0);
    if (sortKey === "util") return b.utilProjected - a.utilProjected;
    if (sortKey === "gap") return b.gap - a.gap;
    return a.lang.localeCompare(b.lang);
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {(["lang", "gap", "util", "risk"] as SortKey[]).map((key) => (
              <th
                key={key}
                scope="col"
                className="px-3 py-2 text-left text-xs font-semibold text-(--ssz-text-muted) uppercase tracking-wide cursor-pointer hover:text-(--ssz-text-primary)"
                onClick={() => setSortKey(key)}
                aria-sort={sortKey === key ? "descending" : "none"}
              >
                {key === "lang" && t("languageGap")}
                {key === "gap" && t("headline")}
                {key === "util" && t("projectionChart")}
                {key === "risk" && t("bottleneck")}
                {sortKey === key && <span aria-hidden="true"> ↓</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.lang} className="border-b border-border last:border-0 hover:bg-accent/30">
              <td className="px-3 py-2">
                <LanguageChip lang={row.lang} />
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <LoadBar
                    contact={row.teachersHaving}
                    cap={row.teachersNeeded}
                    className="w-20"
                  />
                  <span className={cn("text-xs tabular-nums", row.gap > 0 ? "text-error-600" : "text-success-600")}>
                    {row.gap > 0 ? `+${row.gap}` : row.gap}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-xs tabular-nums">
                {Math.round(row.utilProjected * 100)}%
              </td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    row.risk === "high"
                      ? "bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400"
                      : row.risk === "medium"
                        ? "bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-400"
                        : "bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-400",
                  )}
                >
                  {row.risk === "high" && t("riskHigh")}
                  {row.risk === "medium" && t("riskMedium")}
                  {row.risk === "low" && t("riskLow")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
