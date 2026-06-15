'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from '@/lib/i18n/navigation';

import { studentRegisterSchema, type StudentRegisterInput } from '../schemas/register';
import { studentRegisterAction } from '../actions/register';
import type { EntryIntent } from '@/lib/enrollment/intent';

type Props = {
  intent: EntryIntent;
  /** Pre-filled and locked email (invite flow). */
  prefillEmail?: string;
  schoolName?: string;
};

export function EnrollmentRegisterForm({ intent, prefillEmail, schoolName }: Props) {
  const t = useTranslations('Auth.Register');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StudentRegisterInput>({
    resolver: zodResolver(studentRegisterSchema),
    defaultValues: prefillEmail ? { email: prefillEmail } : undefined,
  });

  function onSubmit(data: StudentRegisterInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await studentRegisterAction(data, intent);
      if (!result.ok) {
        if (result.error.code === 'validation' && result.error.details) {
          const details = result.error.details as Record<string, string[]>;
          Object.entries(details).forEach(([field, msgs]) => {
            setError(field as keyof StudentRegisterInput, {
              message: msgs[0] ?? 'Invalid',
            });
          });
          return;
        }
        if (result.error.code === 'conflict') {
          setError('email', { message: t('emailTaken') });
          return;
        }
        setServerError(tErrors('unknown'));
        return;
      }

      toast.success(t('successTitle'));
      router.push(result.value.redirectTo);
    });
  }

  const emailLocked = !!prefillEmail;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {intent.kind === 'join_school' && schoolName && (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-(--ssz-text-secondary)">
          {t('joiningSchool', { school: schoolName })}
        </p>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Field>
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          disabled={emailLocked}
          aria-disabled={emailLocked}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </Field>

      <Field>
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive" role="alert">
            {errors.password.message}
          </p>
        )}
      </Field>

      <Field>
        <Label htmlFor="passwordConfirm">{t('passwordConfirm')}</Label>
        <Input
          id="passwordConfirm"
          type="password"
          autoComplete="new-password"
          {...register('passwordConfirm')}
        />
        {errors.passwordConfirm && (
          <p className="text-sm text-destructive" role="alert">
            {errors.passwordConfirm.message}
          </p>
        )}
      </Field>

      <Field>
        <Label htmlFor="dateOfBirth">{t('dateOfBirth')}</Label>
        <Input
          id="dateOfBirth"
          type="date"
          autoComplete="bday"
          {...register('dateOfBirth')}
        />
        {errors.dateOfBirth && (
          <p className="text-sm text-destructive" role="alert">
            {errors.dateOfBirth.message}
          </p>
        )}
      </Field>

      <div className="flex items-start gap-2">
        <Checkbox id="acceptedTerms" {...register('acceptedTerms')} />
        <Label htmlFor="acceptedTerms" className="leading-snug">
          {t('acceptedTerms')}
        </Label>
      </div>
      {errors.acceptedTerms && (
        <p className="text-sm text-destructive" role="alert">
          {errors.acceptedTerms.message}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t('submitting') : t('submit')}
      </Button>

      <p className="text-center text-sm text-(--ssz-text-muted)">
        {t('hasAccount')}{' '}
        <Link href="/login" className="text-(--ssz-text-link) hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </form>
  );
}
