"use client";

import { useTranslations } from "next-intl";
import type { ForecastParams } from "../../types";

type SliderDef = {
  key: keyof ForecastParams;
  min: number;
  max: number;
  step: number;
};

const SLIDERS: SliderDef[] = [
  { key: "growth",            min: 0,   max: 5,   step: 0.1 },
  { key: "terms",             min: 1,   max: 20,  step: 1   },
  { key: "groupSize",         min: 1,   max: 50,  step: 1   },
  { key: "hoursPerGroup",     min: 0.5, max: 40,  step: 0.5 },
  { key: "contractPerTeacher", min: 1,  max: 60,  step: 1   },
];

type AssumptionSlidersProps = {
  params: ForecastParams;
  onChange: (params: ForecastParams) => void;
};

export function AssumptionSliders({ params, onChange }: AssumptionSlidersProps) {
  const t = useTranslations("Teachers.forecast.sliders");

  function handleChange(key: keyof ForecastParams, value: number) {
    onChange({ ...params, [key]: value });
  }

  return (
    <div className="space-y-4" aria-label={t("growth")}>
      {SLIDERS.map((s) => {
        const labelKey = s.key as keyof typeof params;
        const label =
          s.key === "growth" ? t("growth")
          : s.key === "terms" ? t("terms")
          : s.key === "groupSize" ? t("groupSize")
          : s.key === "hoursPerGroup" ? t("hoursPerGroup")
          : t("contractPerTeacher");

        return (
          <div key={s.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor={`slider-${s.key}`}
                className="text-sm font-medium text-(--ssz-text-primary)"
              >
                {label}
              </label>
              <span className="text-sm tabular-nums text-(--ssz-text-secondary) min-w-[3rem] text-right">
                {params[labelKey]}
              </span>
            </div>
            <input
              id={`slider-${s.key}`}
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={params[s.key]}
              onChange={(e) => handleChange(s.key, parseFloat(e.target.value))}
              className="w-full accent-primary"
              aria-valuemin={s.min}
              aria-valuemax={s.max}
              aria-valuenow={params[s.key]}
            />
          </div>
        );
      })}
    </div>
  );
}
