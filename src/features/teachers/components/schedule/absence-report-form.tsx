"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportAbsence } from "../../api/mutations";
import { absenceReportSchema, type AbsenceReportInput } from "../../schemas";

type AbsenceReportFormProps = {
  schoolId: string;
  teacherId: string;
  onSuccess?: () => void;
};

export function AbsenceReportForm({ schoolId, teacherId, onSuccess }: AbsenceReportFormProps) {
  const t = useTranslations("Teachers.absence");
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0] as string;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AbsenceReportInput>({
    resolver: zodResolver(absenceReportSchema),
    defaultValues: {
      kind: "sick",
      scope: "today",
      from: today,
      to: null,
      reason: "",
    },
  });

  const scope = watch("scope");
  const kind = watch("kind");

  function onSubmit(data: AbsenceReportInput) {
    startTransition(async () => {
      const result = await reportAbsence(schoolId, {
        teacherId,
        ...data,
      });
      if (result.ok) {
        toast.success(t("title"));
        reset();
        onSuccess?.();
      } else {
        toast.error(t("title"));
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
      aria-label={t("title")}
    >
      {/* Kind */}
      <div className="space-y-1.5">
        <Label htmlFor="absence-kind">{t("kindLabel")}</Label>
        <Select
          value={kind}
          onValueChange={(v) => setValue("kind", v as AbsenceReportInput["kind"])}
        >
          <SelectTrigger id="absence-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sick">{t("kindSick")}</SelectItem>
            <SelectItem value="leave">{t("kindLeave")}</SelectItem>
            <SelectItem value="vacancy">{t("kindVacancy")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Scope */}
      <div className="space-y-1.5">
        <Label htmlFor="absence-scope">{t("scopeLabel")}</Label>
        <Select
          value={scope}
          onValueChange={(v) => {
            setValue("scope", v as AbsenceReportInput["scope"]);
            if (v === "permanent") setValue("to", null);
          }}
        >
          <SelectTrigger id="absence-scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t("scopeToday")}</SelectItem>
            <SelectItem value="window">{t("scopeWindow")}</SelectItem>
            <SelectItem value="permanent">{t("scopePermanent")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date range (window only) */}
      {scope === "window" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="absence-from">{t("fromLabel")}</Label>
            <Input
              id="absence-from"
              type="date"
              aria-invalid={!!errors.from}
              {...register("from")}
            />
            {errors.from && (
              <p role="alert" className="text-xs text-error-600">{errors.from.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="absence-to">{t("toLabel")}</Label>
            <Input
              id="absence-to"
              type="date"
              aria-invalid={!!errors.to}
              {...register("to")}
            />
            {errors.to && (
              <p role="alert" className="text-xs text-error-600">{errors.to.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Reason */}
      <div className="space-y-1.5">
        <Label htmlFor="absence-reason">{t("reasonLabel")}</Label>
        <Textarea
          id="absence-reason"
          rows={3}
          aria-invalid={!!errors.reason}
          {...register("reason")}
        />
        {errors.reason && (
          <p role="alert" className="text-xs text-error-600">{errors.reason.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
        {t("submitButton")}
      </Button>
    </form>
  );
}
