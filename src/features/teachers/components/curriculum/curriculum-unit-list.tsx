"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { reorderUnits } from "../../api/mutations";
import type { CurriculumUnit, CurriculumPlan } from "../../types";

type CurriculumUnitListProps = {
  schoolId: string;
  plan: CurriculumPlan;
  onUpdated?: () => void;
};

function StatusPill({ status }: { status: CurriculumUnit["status"] }) {
  const t = useTranslations("Teachers.curriculum");
  const cls =
    status === "done"
      ? "bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-400"
      : status === "active"
        ? "bg-primary/10 text-primary"
        : status === "overridden"
          ? "bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-400"
          : "bg-muted text-(--ssz-text-muted)";

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>
      {status === "planned" && t("statusPlanned")}
      {status === "active" && t("statusActive")}
      {status === "done" && t("statusDone")}
      {status === "overridden" && t("statusOverridden")}
    </span>
  );
}

export function CurriculumUnitList({ schoolId, plan, onUpdated }: CurriculumUnitListProps) {
  const t = useTranslations("Teachers.curriculum");
  const [units, setUnits] = useState(
    [...plan.units].sort((a, b) => a.order - b.order),
  );
  const [isPending, startTransition] = useTransition();

  function moveUnit(index: number, direction: -1 | 1) {
    const newUnits = [...units];
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= newUnits.length) return;
    [newUnits[index], newUnits[swapIdx]] = [newUnits[swapIdx]!, newUnits[index]!];
    const reordered = newUnits.map((u, i) => ({ ...u, order: i + 1 }));
    setUnits(reordered);
    startTransition(async () => {
      await reorderUnits(schoolId, plan.groupId, reordered.map((u) => u.unitId));
      onUpdated?.();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-(--ssz-text-primary)">{t("units")}</h3>
        <div className="text-xs text-(--ssz-text-muted)">
          {Math.round(plan.progressPct)}% {t("statusDone").toLowerCase()}
        </div>
      </div>

      <p className="text-xs text-(--ssz-text-muted)">{t("deliveredNote")}</p>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(plan.progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("units")}
        className="h-1.5 rounded-full bg-muted overflow-hidden"
      >
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${plan.progressPct}%` }}
        />
      </div>

      <ul className="space-y-1.5" aria-label={t("units")}>
        {units.map((unit, index) => (
          <li
            key={unit.unitId}
            className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5"
          >
            {/* Order controls */}
            <div className="flex flex-col shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 h-5 w-5"
                aria-label="Move up"
                disabled={index === 0 || isPending}
                onClick={() => moveUnit(index, -1)}
              >
                <ChevronUp className="size-3" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 h-5 w-5"
                aria-label="Move down"
                disabled={index === units.length - 1 || isPending}
                onClick={() => moveUnit(index, 1)}
              >
                <ChevronDown className="size-3" aria-hidden="true" />
              </Button>
            </div>

            {/* Drag handle (visual only) */}
            <GripVertical className="size-4 text-(--ssz-text-muted) mt-0.5 shrink-0 cursor-grab" aria-hidden="true" />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-(--ssz-text-primary) truncate">
                  {unit.title}
                </span>
                <StatusPill status={unit.status} />
                <Badge variant="muted" className="text-[10px] h-4">
                  {unit.requiredLevel}
                </Badge>
              </div>
              <p className="text-xs text-(--ssz-text-muted) mt-0.5">
                {t("sessions", {
                  delivered: unit.deliveredSessions,
                  planned: unit.plannedSessions,
                })}
              </p>
            </div>

          </li>
        ))}
      </ul>
    </div>
  );
}
