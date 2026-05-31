'use client';

import { useTransition } from 'react';
import { useForm, useController, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LOCALE_LABELS, LOCALES } from '@/lib/i18n/config';
import { onboardingProfileSchema, type OnboardingProfileValues } from '../../schemas/onboarding';
import { saveProfileStepAction } from '../../actions/save-profile-step';
import { useOnboardingStore } from '../../stores/onboarding-store';
import { TimezoneSelect } from './timezone-select';

type StepProfileProps = {
  initialValues: OnboardingProfileValues;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
  onNext: () => void;
};

export function StepProfile({ initialValues, headingRef, onNext }: StepProfileProps) {
  const t = useTranslations('Onboarding');
  const [isPending, startTransition] = useTransition();

  const setProfileDraft = useOnboardingStore((s) => s.setProfileDraft);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingProfileValues>({
    resolver: zodResolver(onboardingProfileSchema),
    defaultValues: initialValues,
    mode: 'onBlur',
  });

  const { field: tzField } = useController({ name: 'timezone', control });
  const { field: localeField } = useController({ name: 'uiLocale', control });

  const bioValue = useWatch({ control, name: 'bio' }) ?? '';
  const bioLength = bioValue.length;

  function onSubmit(data: OnboardingProfileValues) {
    setProfileDraft({
      displayName: data.displayName,
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      timezone: data.timezone,
      locale: data.uiLocale,
      bio: data.bio ?? '',
    });

    startTransition(async () => {
      const result = await saveProfileStepAction(data);
      if (!result.ok) {
        toast.error(t('error.saveFailed'));
        return;
      }
      onNext();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold text-(--ssz-text-primary) focus:outline-none"
        >
          {t('step.profile.title')}
        </h1>
        <p className="mt-2 text-(--ssz-text-secondary) leading-relaxed">{t('step.profile.subtitle')}</p>
      </div>

      <Field
        label={t('profile.displayName.label')}
        htmlFor="displayName"
        error={errors.displayName?.message}
        required
      >
        <Input
          id="displayName"
          autoComplete="name"
          placeholder={t('profile.displayName.placeholder')}
          hasError={!!errors.displayName}
          disabled={isPending}
          {...register('displayName')}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t('profile.firstName.label')} htmlFor="firstName" error={errors.firstName?.message}>
          <Input
            id="firstName"
            autoComplete="given-name"
            disabled={isPending}
            {...register('firstName')}
          />
        </Field>
        <Field label={t('profile.lastName.label')} htmlFor="lastName" error={errors.lastName?.message}>
          <Input
            id="lastName"
            autoComplete="family-name"
            disabled={isPending}
            {...register('lastName')}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t('profile.timezone.label')} htmlFor="timezone" error={errors.timezone?.message} required>
          <TimezoneSelect
            id="timezone"
            value={tzField.value}
            onChange={tzField.onChange}
            detectedZone={initialValues.timezone}
            placeholder={t('profile.timezone.placeholder')}
            disabled={isPending}
          />
        </Field>

        <Field label={t('profile.locale.label')} htmlFor="uiLocale" error={errors.uiLocale?.message} required>
          <Select value={localeField.value} onValueChange={localeField.onChange} disabled={isPending}>
            <SelectTrigger id="uiLocale" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((locale) => (
                <SelectItem key={locale} value={locale}>
                  {LOCALE_LABELS[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="bio" className="text-sm font-medium text-(--ssz-text-primary)">
            {t('profile.bio.label')}
          </label>
          <span
            aria-live="polite"
            className={
              bioLength >= 200
                ? 'text-xs text-(--ssz-color-error-600)'
                : bioLength >= 180
                  ? 'text-xs text-(--ssz-color-warning-600)'
                  : 'text-xs text-(--ssz-text-muted)'
            }
          >
            {t('profile.bio.counter', { count: bioLength })}
          </span>
        </div>
        <Textarea
          id="bio"
          rows={4}
          placeholder={t('profile.bio.placeholder')}
          hasError={!!errors.bio}
          disabled={isPending}
          {...register('bio')}
        />
        {errors.bio && <p className="text-xs text-error">{errors.bio.message}</p>}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={isPending}>
          {t('next')}
        </Button>
      </div>
    </form>
  );
}
