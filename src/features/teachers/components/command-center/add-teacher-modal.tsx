"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addTeacher } from "../../api/mutations";
import type { InviteBranch } from "../../api/mutations";
import { teacherAddSchema, type TeacherAddInput } from "../../schemas";

const FULL_TIME_CONTACT_HOURS = 40;

type AddTeacherModalProps = {
  schoolId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddTeacherModal({ schoolId, open, onClose, onSuccess }: AddTeacherModalProps) {
  const t = useTranslations("Teachers.roster.addModal");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<InviteBranch | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<TeacherAddInput>({
    resolver: zodResolver(teacherAddSchema),
    defaultValues: {
      email: "",
      maxWeeklyContactHours: 20,
      employmentType: "part",
    },
  });

  const employmentType = watch("employmentType");

  function handleClose() {
    reset();
    setResult(null);
    clearErrors();
    onClose();
  }

  function onSubmit(data: TeacherAddInput) {
    startTransition(async () => {
      const outcome = await addTeacher(schoolId, data);
      if (outcome.success) {
        setResult(outcome.data);
        if (outcome.data.branch !== "added") {
          toast.success(t("inviteButton"));
        }
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1500);
      } else {
        if (outcome.error === "conflict") {
          setError("email", { message: t("noLangs") });
        } else {
          setError("root" as "email", { message: t("notFound") });
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-3">
            {result.branch === "added" && (
              <p className="text-sm text-(--ssz-text-primary)">{t("foundTeacher")}</p>
            )}
            {result.branch === "register" && (
              <>
                <p className="text-sm text-(--ssz-text-primary)">{t("notFound")}</p>
                <p className="text-xs text-(--ssz-text-muted)">{result.email}</p>
              </>
            )}
            {result.branch === "onboard" && (
              <>
                <p className="text-sm text-(--ssz-text-primary)">{t("foundUser")}</p>
                <p className="text-xs text-(--ssz-text-muted)">{result.email}</p>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="teacher-email">{t("emailLabel")}</Label>
              <Input
                id="teacher-email"
                type="email"
                placeholder="teacher@example.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p role="alert" className="text-xs text-error-600 dark:text-error-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="teacher-hours">{t("hoursLabel")}</Label>
              <Input
                id="teacher-hours"
                type="number"
                min={1}
                max={60}
                disabled={employmentType === "full"}
                aria-invalid={!!errors.maxWeeklyContactHours}
                className={employmentType === "full" ? "opacity-50 cursor-not-allowed" : ""}
                {...register("maxWeeklyContactHours", { valueAsNumber: true })}
              />
              {errors.maxWeeklyContactHours && (
                <p role="alert" className="text-xs text-error-600 dark:text-error-400">
                  {errors.maxWeeklyContactHours.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="teacher-employment">{t("employmentLabel")}</Label>
              <Select
                value={employmentType}
                onValueChange={(v) => {
                  const type = v as TeacherAddInput["employmentType"];
                  setValue("employmentType", type, { shouldValidate: true });
                  if (type === "full") {
                    setValue("maxWeeklyContactHours", FULL_TIME_CONTACT_HOURS, { shouldValidate: true });
                  } else if (employmentType === "full") {
                    setValue("maxWeeklyContactHours", 20, { shouldValidate: false });
                  }
                }}
              >
                <SelectTrigger id="teacher-employment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{t("employmentFull")}</SelectItem>
                  <SelectItem value="part">{t("employmentPart")}</SelectItem>
                  <SelectItem value="contract">{t("employmentContract")}</SelectItem>
                </SelectContent>
              </Select>
              {errors.employmentType && (
                <p role="alert" className="text-xs text-error-600 dark:text-error-400">
                  {errors.employmentType.message}
                </p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                {t("cancelButton")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                    {t("lookingUp")}
                  </>
                ) : (
                  t("inviteButton")
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
