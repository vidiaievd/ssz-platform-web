"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

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

const LANGUAGE_OPTIONS = [
  { code: "nb", label: "Norsk" },
  { code: "en", label: "English" },
  { code: "uk", label: "Українська" },
  { code: "ru", label: "Русский" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pl", label: "Polski" },
  { code: "ar", label: "العربية" },
] as const;

const LEVEL_OPTIONS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

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
    control,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<TeacherAddInput>({
    resolver: zodResolver(teacherAddSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      maxWeeklyContactHours: 20,
      employmentType: "part",
      teachingLanguages: [{ code: "nb", level: "B2" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "teachingLanguages",
  });

  const employmentType = watch("employmentType");
  const teachingLanguages = watch("teachingLanguages");

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
            {result.branch === "onboard_existing" && (
              <>
                <p className="text-sm text-(--ssz-text-primary)">{t("foundUser")}</p>
                <p className="text-xs text-(--ssz-text-muted)">{result.email}</p>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="teacher-first-name">{t("firstNameLabel")}</Label>
                <Input
                  id="teacher-first-name"
                  type="text"
                  autoComplete="given-name"
                  {...register("firstName")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="teacher-last-name">{t("lastNameLabel")}</Label>
                <Input
                  id="teacher-last-name"
                  type="text"
                  autoComplete="family-name"
                  {...register("lastName")}
                />
              </div>
            </div>
            <p className="text-xs text-(--ssz-text-muted) -mt-2">{t("nameHint")}</p>

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

            {/* Teaching languages */}
            <div className="space-y-2">
              <Label>{t("langsLabel")}</Label>
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2 items-center">
                    <Select
                      value={teachingLanguages[idx]?.code ?? "nb"}
                      onValueChange={(v) =>
                        setValue(`teachingLanguages.${idx}.code`, v, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger className="flex-1" aria-label={t("langsLanguageLabel")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={teachingLanguages[idx]?.level ?? "B2"}
                      onValueChange={(v) =>
                        setValue(
                          `teachingLanguages.${idx}.level`,
                          v as TeacherAddInput["teachingLanguages"][number]["level"],
                          { shouldValidate: true },
                        )
                      }
                    >
                      <SelectTrigger className="w-24" aria-label={t("langsLevelLabel")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVEL_OPTIONS.map((lvl) => (
                          <SelectItem key={lvl} value={lvl}>
                            {lvl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={fields.length === 1}
                      onClick={() => remove(idx)}
                      aria-label={t("langsRemoveLabel")}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ code: "nb", level: "B2" })}
                className="mt-1"
              >
                <Plus className="size-4 mr-1.5" aria-hidden="true" />
                {t("langsAddButton")}
              </Button>

              {errors.teachingLanguages && (
                <p role="alert" className="text-xs text-error-600 dark:text-error-400">
                  {t("langsRequired")}
                </p>
              )}

              <p className="text-xs text-(--ssz-text-muted)">{t("langsHint")}</p>
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
