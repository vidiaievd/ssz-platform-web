"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import { forgotPasswordAction } from "../actions/forgot-password";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../schemas";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth.ForgotPassword");
  const tErrors = useTranslations("Errors");
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  function onSubmit(data: ForgotPasswordInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await forgotPasswordAction(data);
      if (!result.ok) {
        setServerError(tErrors(result.error.code));
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-semibold text-(--ssz-text-primary)">
          {t("successTitle")}
        </p>
        <p className="text-sm text-(--ssz-text-muted)">
          {t("successDescription", { email: getValues("email") })}
        </p>
        <Link
          href="/login"
          className="text-sm text-(--ssz-text-link) hover:underline"
        >
          {t("backToSignIn")}
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
      <Field
        label={t("email")}
        htmlFor="email"
        error={errors.email?.message}
        required
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          hasError={!!errors.email}
          disabled={isPending}
          {...register("email")}
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

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-(--ssz-text-link) hover:underline"
        >
          {t("backToSignIn")}
        </Link>
      </div>
    </form>
  );
}
