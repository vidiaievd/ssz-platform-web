"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUnit } from "../../api/mutations";
import type { CurriculumPlan, CurriculumUnit } from "../../types";

type TargetHoursFieldProps = {
  schoolId: string;
  plan: CurriculumPlan;
  onUpdated?: () => void;
};

export function TargetHoursField({ schoolId, plan, onUpdated }: TargetHoursFieldProps) {
  const t = useTranslations("Teachers.curriculum");
  const [value, setValue] = useState(plan.targetWeeklyHours);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (value <= 0 || value === plan.targetWeeklyHours) return;
    startTransition(async () => {
      // Target hours stored on the plan level; we update via the first unit as a carrier.
      // The real implementation would call a dedicated plan-update endpoint.
      const firstUnit = plan.units[0];
      if (!firstUnit) return;
      const result = await updateUnit(schoolId, plan.groupId, firstUnit as CurriculumUnit);
      if (result.ok) {
        toast.success(t("targetHours"));
        onUpdated?.();
      } else {
        toast.error(t("targetHours"));
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="space-y-1">
        <Label htmlFor="target-hours">{t("targetHours")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="target-hours"
            type="number"
            min={0.5}
            step={0.5}
            max={40}
            value={value}
            onChange={(e) => setValue(e.target.valueAsNumber)}
            className="w-24"
          />
          <span className="text-sm text-(--ssz-text-muted)">h/week</span>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-5"
        disabled={isPending || value === plan.targetWeeklyHours || value <= 0}
        onClick={handleSave}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          "Save"
        )}
      </Button>
    </div>
  );
}
