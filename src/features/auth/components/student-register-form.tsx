"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";

import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { registerAction } from "../actions/register";
import { passwordSchema } from "../schemas";

const studentSchema = z
  .object({
    email: z.string().email(),
    password: passwordSchema,
    passwordConfirm: z.string(),
    acceptedTerms: z.literal(true, { message: "You must accept the terms" }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });

type StudentInput = z.infer<typeof studentSchema>;

export function StudentRegisterForm() {
  const t = useTranslations("Auth.Register");
  const tErrors = useTranslations("Errors");
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StudentInput>({ resolver: zodResolver(studentSchema) });

  function onSubmit(data: StudentInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await registerAction({ ...data, role: "student" });
      if (!result.ok) {
        if (result.error.code === "conflict") {
          setError("email", { message: tErrors("conflict") });
        } else {
          setServerError(tErrors(result.error.code));
        }
        return;
      }
      setSuccessEmail(data.email);
    });
  }

  if (successEmail) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-semibold text-(--ssz-text-primary)">{t("successTitle")}</p>
        <p className="text-sm text-(--ssz-text-muted)">
          {t("successDescription", { email: successEmail })}
        </p>
        <Link href="/login" className="text-sm text-(--ssz-text-link) hover:underline">
          {t("signIn")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Field label={t("email")} htmlFor="email" error={errors.email?.message} required>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          hasError={!!errors.email}
          disabled={isPending}
          {...register("email")}
        />
      </Field>

      <Field label={t("password")} htmlFor="password" error={errors.password?.message} required>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          hasError={!!errors.password}
          disabled={isPending}
          {...register("password")}
        />
      </Field>

      <Field
        label={t("passwordConfirm")}
        htmlFor="passwordConfirm"
        error={errors.passwordConfirm?.message}
        required
      >
        <Input
          id="passwordConfirm"
          type="password"
          autoComplete="new-password"
          hasError={!!errors.passwordConfirm}
          disabled={isPending}
          {...register("passwordConfirm")}
        />
      </Field>

      <Field error={errors.acceptedTerms?.message}>
        <Controller
          control={control}
          name="acceptedTerms"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id="acceptedTerms"
                checked={field.value === true}
                onCheckedChange={(val) => field.onChange(val === true)}
                disabled={isPending}
              />
              <Label htmlFor="acceptedTerms" className="font-normal">
                {t("acceptedTerms")}
              </Label>
            </div>
          )}
        />
      </Field>

      {serverError && (
        <p role="alert" className="text-sm text-error">
          {serverError}
        </p>
      )}

      <Button type="submit" loading={isPending} className="w-full">
        {t("submit")}
      </Button>

      <p className="text-center text-sm text-(--ssz-text-muted)">
        {t("hasAccount")}{" "}
        <Link href="/login" className="text-(--ssz-text-link) hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
