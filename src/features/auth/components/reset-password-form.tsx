"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import { resetPasswordAction } from "../actions/reset-password";
import { resetPasswordSchema, type ResetPasswordInput } from "../schemas";

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations("Auth.ResetPassword");
  const tErrors = useTranslations("Errors");
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  function onSubmit(data: ResetPasswordInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(data);
      if (!result.ok) {
        setServerError(tErrors(result.error.code));
        return;
      }
      setSuccess(true);
    });
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-semibold text-(--ssz-text-primary)">
          {t("successTitle")}
        </p>
        <p className="text-sm text-(--ssz-text-muted)">
          {t("successDescription")}
        </p>
        <Link
          href="/login"
          className="text-sm text-(--ssz-text-link) hover:underline"
        >
          {t("signIn")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" {...register("token")} />

      <Field
        label={t("password")}
        htmlFor="password"
        error={errors.password?.message}
        required
      >
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

      {serverError && (
        <p role="alert" className="text-sm text-error">
          {serverError}
        </p>
      )}

      <Button type="submit" loading={isPending} className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
