"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import type { ForecastResult } from "../../types";

type BottleneckCalloutProps = {
  bottleneck: ForecastResult["bottleneck"];
};

export function BottleneckCallout({ bottleneck }: BottleneckCalloutProps) {
  const t = useTranslations("Teachers.forecast");

  if (!bottleneck) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-950/30 px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-error-500" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-(--ssz-text-primary)">{t("bottleneck")}</p>
        <p className="text-sm text-(--ssz-text-secondary)">
          {t("bottleneckDetail", {
            lang: bottleneck.lang.toUpperCase(),
            util: Math.round(bottleneck.utilProjected * 100),
          })}
        </p>
      </div>
    </div>
  );
}
