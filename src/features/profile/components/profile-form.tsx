'use client';

import { useWatch } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';

import { Field, Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrentUser } from '@/features/auth/api/use-current-user';

import { useMyProfile } from '../api/use-my-profile';
import { useProfileSettingsForm } from '../hooks/use-profile-settings-form';
import { TimezoneSelect } from './timezone-select';

export function ProfileForm() {
  const t = useTranslations('Profile');
  const { isLoading } = useMyProfile();
  const { data: currentUser } = useCurrentUser();
  const { form, isPending } = useProfileSettingsForm();

  const {
    register,
    control,
    formState: { errors },
  } = form;

  const bio = useWatch({ control, name: 'bio' }) ?? '';

  if (isLoading) return <ProfileFormSkeleton />;

  return (
    <div className="space-y-6 max-w-xl">
      <p className="text-xs text-(--ssz-text-muted)">
        {t('form.requiredLegend')}
      </p>

      {currentUser?.email && (
        <Field label={t('email')} htmlFor="account-email">
          <div className="relative">
            <Input
              id="account-email"
              type="email"
              value={currentUser.email}
              disabled
              readOnly
              className="text-(--ssz-text-muted) pr-9"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-(--ssz-text-muted) cursor-default">
                    <Lock className="size-3.5" aria-hidden />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {t('form.emailLockedTooltip')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </Field>
      )}

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
        <div className="space-y-1">
          <Textarea
            id="bio"
            rows={3}
            hasError={!!errors.bio}
            disabled={isPending}
            {...register('bio', { setValueAs: (v: string | null) => (!v || v.trim() === '' ? null : v) })}
          />
          <p className="text-xs text-(--ssz-text-muted) text-right tabular-nums">
            {bio.length}/500
          </p>
        </div>
      </Field>

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
    </div>
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
    </div>
  );
}
