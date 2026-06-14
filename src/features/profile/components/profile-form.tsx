'use client';

import { useEffect, useTransition } from 'react';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { LOCALE_LABELS, LOCALES } from '@/lib/i18n/config';

import { updateProfileSchema, type UpdateProfileInput } from '../schemas';
import { useMyProfile } from '../api/use-my-profile';
import { updateProfileAction } from '../api/update-profile';
import { profileKeys } from '../api/keys';
import { LocaleSelect } from './locale-select';
import { TimezoneSelect } from './timezone-select';

export function ProfileForm() {
  const t = useTranslations('Profile');
  const tErrors = useTranslations('Errors');
  const { data: profile, isLoading } = useMyProfile();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: null,
      lastName: null,
      handle: null,
      displayName: '',
      bio: null,
      uiLocale: 'en',
      instructionLocales: [],
      timezone: 'UTC',
      contactEmail: null,
      contactPhone: null,
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (!profile) return;
    reset({
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
      handle: profile.handle ?? null,
      displayName: profile.displayName,
      bio: profile.bio ?? null,
      uiLocale: (LOCALES.includes(profile.uiLocale as (typeof LOCALES)[number])
        ? profile.uiLocale
        : 'en') as UpdateProfileInput['uiLocale'],
      instructionLocales: (profile.instructionLocales ?? []).filter(
        (l): l is (typeof LOCALES)[number] => LOCALES.includes(l as (typeof LOCALES)[number]),
      ),
      timezone: profile.timezone ?? 'UTC',
      contactEmail: profile.contactEmail ?? null,
      contactPhone: profile.contactPhone ?? null,
    });
  }, [profile, reset]);

  function onSubmit(data: UpdateProfileInput) {
    const savedProfile = profile;
    startTransition(async () => {
      const result = await updateProfileAction(data);
      if (!result.ok) {
        if (savedProfile) {
          reset({
            firstName: savedProfile.firstName ?? null,
            lastName: savedProfile.lastName ?? null,
            handle: savedProfile.handle ?? null,
            displayName: savedProfile.displayName,
            bio: savedProfile.bio ?? null,
            uiLocale: savedProfile.uiLocale as UpdateProfileInput['uiLocale'],
            instructionLocales: (savedProfile.instructionLocales ?? []) as UpdateProfileInput['instructionLocales'],
            timezone: savedProfile.timezone ?? 'UTC',
            contactEmail: savedProfile.contactEmail ?? null,
            contactPhone: savedProfile.contactPhone ?? null,
          });
        }
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      toast.success(t('saveSuccess'));
    });
  }

  if (isLoading) return <ProfileFormSkeleton />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('firstName')} htmlFor="firstName" error={errors.firstName?.message}>
          <Input
            id="firstName"
            autoComplete="given-name"
            hasError={!!errors.firstName}
            disabled={isPending}
            {...register('firstName', { setValueAs: (v: string | null) => (!v || v.trim() === '' ? null : v) })}
          />
        </Field>
        <Field label={t('lastName')} htmlFor="lastName" error={errors.lastName?.message}>
          <Input
            id="lastName"
            autoComplete="family-name"
            hasError={!!errors.lastName}
            disabled={isPending}
            {...register('lastName', { setValueAs: (v: string | null) => (!v || v.trim() === '' ? null : v) })}
          />
        </Field>
      </div>

      <Field label={t('handle')} htmlFor="handle" error={errors.handle?.message}>
        <div className="flex items-center">
          <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-(--ssz-text-muted)">
            ssz.app/
          </span>
          <Input
            id="handle"
            autoComplete="off"
            hasError={!!errors.handle}
            disabled={isPending}
            className="rounded-l-none"
            {...register('handle', { setValueAs: (v: string | null) => (!v || v.trim() === '' ? null : v.trim().toLowerCase()) })}
          />
        </div>
      </Field>

      <Field
        label={t('displayName')}
        htmlFor="displayName"
        error={errors.displayName?.message}
        required
      >
        <Input
          id="displayName"
          autoComplete="name"
          hasError={!!errors.displayName}
          disabled={isPending}
          {...register('displayName')}
        />
      </Field>

      <Field label={t('bio')} htmlFor="bio" error={errors.bio?.message}>
        <Textarea
          id="bio"
          rows={3}
          hasError={!!errors.bio}
          disabled={isPending}
          {...register('bio', { setValueAs: (v: string | null) => (!v || v.trim() === '' ? null : v) })}
        />
      </Field>

      <Field label={t('uiLocale')} htmlFor="uiLocale" error={errors.uiLocale?.message} required>
        <LocaleSelect name="uiLocale" control={control} disabled={isPending} />
      </Field>

      <InstructionLocalesField control={control} disabled={isPending} t={t} />

      <Field
        label={t('timezone')}
        htmlFor="timezone"
        error={errors.timezone?.message}
        required
      >
        <TimezoneSelect control={control} disabled={isPending} />
      </Field>

      <Field
        label={t('contactEmail')}
        htmlFor="contactEmail"
        error={errors.contactEmail?.message}
      >
        <Input
          id="contactEmail"
          type="email"
          autoComplete="email"
          hasError={!!errors.contactEmail}
          disabled={isPending}
          {...register('contactEmail', { setValueAs: (v: string | null) => (!v || v.trim() === '' ? null : v) })}
        />
      </Field>

      <Field
        label={t('contactPhone')}
        htmlFor="contactPhone"
        error={errors.contactPhone?.message}
      >
        <Input
          id="contactPhone"
          type="tel"
          autoComplete="tel"
          hasError={!!errors.contactPhone}
          disabled={isPending}
          {...register('contactPhone', { setValueAs: (v: string | null) => (!v || v.trim() === '' ? null : v) })}
        />
      </Field>

      <Button type="submit" loading={isPending}>
        {t('save')}
      </Button>
    </form>
  );
}

type InstructionLocalesFieldProps = {
  control: ReturnType<typeof useForm<UpdateProfileInput>>['control'];
  disabled?: boolean;
  t: ReturnType<typeof useTranslations<'Profile'>>;
};

function InstructionLocalesField({ control, disabled, t }: InstructionLocalesFieldProps) {
  const { field } = useController({ name: 'instructionLocales', control });
  const selected = field.value ?? [];

  function toggle(locale: string) {
    field.onChange(
      selected.includes(locale as (typeof LOCALES)[number])
        ? selected.filter((l) => l !== locale)
        : [...selected, locale],
    );
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-(--ssz-text-primary)">
        {t('instructionLocales')}
      </legend>
      <div className="flex flex-wrap gap-4">
        {LOCALES.map((locale) => (
          <label key={locale} className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={selected.includes(locale)}
              onCheckedChange={() => toggle(locale)}
              disabled={disabled}
            />
            <span className="text-sm">{LOCALE_LABELS[locale]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProfileFormSkeleton() {
  return (
    <div className="space-y-6 max-w-xl">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-24" />
    </div>
  );
}
