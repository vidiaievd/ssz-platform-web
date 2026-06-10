"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applyOverride } from "../../api/mutations";
import type { CurriculumPlan } from "../../types";

const overrideSchema = z.object({
  unitId: z.string().min(1),
  reason: z.string().min(3).max(500),
});
type OverrideInput = z.infer<typeof overrideSchema>;

type CurriculumOverrideActionProps = {
  schoolId: string;
  plan: CurriculumPlan;
  onOverridden?: () => void;
};

export function CurriculumOverrideAction({ schoolId, plan, onOverridden }: CurriculumOverrideActionProps) {
  const t = useTranslations("Teachers.curriculum");
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OverrideInput>({
    resolver: zodResolver(overrideSchema),
    defaultValues: { unitId: "", reason: "" },
  });

  function onSubmit(data: OverrideInput) {
    startTransition(async () => {
      const result = await applyOverride(schoolId, plan.groupId, data.unitId, data.reason, plan);
      if (result.ok) {
        toast.success(t("override"));
        reset();
        setOpen(false);
        onOverridden?.();
      } else {
        toast.error(t("override"));
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("override")}
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-xl border border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-950/20 p-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="override-unit">{t("units")}</Label>
        <Select
          value={selectedUnit}
          onValueChange={(v) => setSelectedUnit(v)}
        >
          <SelectTrigger id="override-unit">
            <SelectValue placeholder={t("selectGroup")} />
          </SelectTrigger>
          <SelectContent>
            {plan.units.map((u) => (
              <SelectItem key={u.unitId} value={u.unitId}>{u.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="override-reason">{t("overrideReason")}</Label>
        <Textarea
          id="override-reason"
          rows={3}
          aria-invalid={!!errors.reason}
          {...register("reason")}
        />
        {errors.reason && (
          <p role="alert" className="text-xs text-error-600">{errors.reason.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); reset(); }}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending || !selectedUnit}>
          {isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
          {t("override")}
        </Button>
      </div>
    </form>
  );
}
