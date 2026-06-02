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
import { resolvePostLoginPath } from '../utils/resolve-post-login-path';

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
      if (result.value.emailVerified === false) {
        router.push("/verify-email");
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
