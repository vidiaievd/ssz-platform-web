'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';

import { mfaChallengeAction } from '../actions/login';
import { mfaChallengeSchema, type MfaChallengeInput } from '../schemas';

function resolvePostLoginPath(
  auth: { roles: string[]; hasStudentProfile: boolean; hasTutorProfile: boolean },
  redirect?: string,
): string {
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  if (auth.roles.includes('school_admin')) {
    return '/school/dashboard';
  }
  if (auth.roles.includes('tutor')) {
    return auth.hasTutorProfile ? '/school/dashboard' : '/onboarding?step=profile';
  }
  if (auth.roles.includes('student')) {
    return auth.hasStudentProfile ? '/student/dashboard' : '/onboarding?step=profile';
  }
  return '/student/dashboard';
}

type TotpStepProps = {
  mfaChallengeToken: string;
  redirect?: string;
  onCancel: () => void;
};

export function TotpStep({ mfaChallengeToken, redirect, onCancel }: TotpStepProps) {
  const t = useTranslations('Auth.Mfa');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<MfaChallengeInput>({
    resolver: zodResolver(mfaChallengeSchema),
    defaultValues: { mfaChallengeToken },
  });

  function onSubmit(data: MfaChallengeInput) {
    startTransition(async () => {
      const result = await mfaChallengeAction(data);
      if (!result.ok) {
        setError('code', { message: tErrors(result.error.code) });
        return;
      }
      router.push(resolvePostLoginPath(result.value, redirect));
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-sm text-(--ssz-text-muted)">{t('description')}</p>
      </div>

      <input type="hidden" {...register('mfaChallengeToken')} />

      <Field label={t('code')} htmlFor="code" error={errors.code?.message} required>
        <Input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t('codePlaceholder')}
          maxLength={6}
          hasError={!!errors.code}
          disabled={isPending}
          {...register('code')}
        />
      </Field>

      <Button type="submit" loading={isPending} className="w-full">
        {t('submit')}
      </Button>

      <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending} className="w-full">
        {t('cancel')}
      </Button>
    </form>
  );
}
