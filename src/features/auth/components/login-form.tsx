'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { Link, useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import type { AppErrorCode } from '@/lib/errors';

import { loginAction } from '../actions/login';
import { loginSchema, type LoginInput } from '../schemas';
import { TotpStep } from './totp-step';

function resolvePostLoginPath(roles: string[], redirect?: string): string {
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  return roles.some((r) => r === 'school' || r === 'tutor') ? '/school' : '/student';
}

type LoginFormProps = {
  redirect?: string;
};

export function LoginForm({ redirect }: LoginFormProps) {
  const t = useTranslations('Auth.Login');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  function onSubmit(data: LoginInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction(data);
      if (!result.ok) {
        const code = result.error.code as AppErrorCode;
        setServerError(
          code === 'unauthenticated' ? t('invalidCredentials') : tErrors(code),
        );
        return;
      }
      if (result.value.stage === 'mfa') {
        setMfaToken(result.value.mfaChallengeToken);
        return;
      }
      router.push(resolvePostLoginPath(result.value.roles, redirect));
    });
  }

  if (mfaToken) {
    return <TotpStep mfaChallengeToken={mfaToken} redirect={redirect} onCancel={() => setMfaToken(null)} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Field label={t('email')} htmlFor="email" error={errors.email?.message} required>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          hasError={!!errors.email}
          disabled={isPending}
          {...register('email')}
        />
      </Field>

      <Field label={t('password')} htmlFor="password" error={errors.password?.message} required>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          hasError={!!errors.password}
          disabled={isPending}
          {...register('password')}
        />
      </Field>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-[var(--ssz-text-link)] hover:underline"
        >
          {t('forgotPassword')}
        </Link>
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-error">
          {serverError}
        </p>
      )}

      <Button type="submit" loading={isPending} className="w-full">
        {t('submit')}
      </Button>

      <p className="text-center text-sm text-[var(--ssz-text-muted)]">
        {t('noAccount')}{' '}
        <Link href="/register" className="text-[var(--ssz-text-link)] hover:underline">
          {t('signUp')}
        </Link>
      </p>
    </form>
  );
}
