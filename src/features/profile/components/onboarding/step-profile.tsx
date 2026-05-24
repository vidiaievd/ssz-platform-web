'use client';

import { useTransition } from 'react';
import { useForm, useController, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LOCALE_LABELS, LOCALES } from '@/lib/i18n/config';
import { onboardingProfileSchema, type OnboardingProfileValues, saveProfileStepAction } from '../../actions/save-profile-step';
import { useOnboardingStore } from '../../stores/onboarding-store';

const TIMEZONE_GROUPS = [
  {
    label: 'UTC',
    timezones: [{ value: 'UTC', label: 'UTC' }],
  },
  {
    label: 'Europe',
    timezones: [
      { value: 'Europe/London', label: 'London' },
      { value: 'Europe/Dublin', label: 'Dublin' },
      { value: 'Europe/Oslo', label: 'Oslo' },
      { value: 'Europe/Copenhagen', label: 'Copenhagen' },
      { value: 'Europe/Stockholm', label: 'Stockholm' },
      { value: 'Europe/Helsinki', label: 'Helsinki' },
      { value: 'Europe/Berlin', label: 'Berlin' },
      { value: 'Europe/Paris', label: 'Paris' },
      { value: 'Europe/Amsterdam', label: 'Amsterdam' },
      { value: 'Europe/Brussels', label: 'Brussels' },
      { value: 'Europe/Madrid', label: 'Madrid' },
      { value: 'Europe/Lisbon', label: 'Lisbon' },
      { value: 'Europe/Rome', label: 'Rome' },
      { value: 'Europe/Vienna', label: 'Vienna' },
      { value: 'Europe/Warsaw', label: 'Warsaw' },
      { value: 'Europe/Athens', label: 'Athens' },
      { value: 'Europe/Bucharest', label: 'Bucharest' },
      { value: 'Europe/Kyiv', label: 'Kyiv' },
      { value: 'Europe/Riga', label: 'Riga' },
      { value: 'Europe/Tallinn', label: 'Tallinn' },
      { value: 'Europe/Vilnius', label: 'Vilnius' },
      { value: 'Europe/Moscow', label: 'Moscow' },
    ],
  },
  {
    label: 'Americas',
    timezones: [
      { value: 'America/New_York', label: 'New York' },
      { value: 'America/Toronto', label: 'Toronto' },
      { value: 'America/Chicago', label: 'Chicago' },
      { value: 'America/Denver', label: 'Denver' },
      { value: 'America/Los_Angeles', label: 'Los Angeles' },
      { value: 'America/Sao_Paulo', label: 'São Paulo' },
      { value: 'America/Buenos_Aires', label: 'Buenos Aires' },
      { value: 'America/Mexico_City', label: 'Mexico City' },
    ],
  },
  {
    label: 'Asia & Pacific',
    timezones: [
      { value: 'Asia/Dubai', label: 'Dubai' },
      { value: 'Asia/Kolkata', label: 'Kolkata' },
      { value: 'Asia/Bangkok', label: 'Bangkok' },
      { value: 'Asia/Singapore', label: 'Singapore' },
      { value: 'Asia/Shanghai', label: 'Shanghai' },
      { value: 'Asia/Tokyo', label: 'Tokyo' },
      { value: 'Asia/Seoul', label: 'Seoul' },
      { value: 'Australia/Sydney', label: 'Sydney' },
      { value: 'Pacific/Auckland', label: 'Auckland' },
    ],
  },
  {
    label: 'Africa',
    timezones: [
      { value: 'Africa/Lagos', label: 'Lagos' },
      { value: 'Africa/Cairo', label: 'Cairo' },
      { value: 'Africa/Johannesburg', label: 'Johannesburg' },
    ],
  },
];

type StepProfileProps = {
  initialValues: OnboardingProfileValues;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
};

export function StepProfile({ initialValues, headingRef }: StepProfileProps) {
  const t = useTranslations('Onboarding');
  const router = useRouter();
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
      router.push('?step=prefs');
    });
  }

  function handleBack() {
    router.push('?step=role');
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
          <Select value={tzField.value} onValueChange={tzField.onChange} disabled={isPending}>
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue placeholder={t('profile.timezone.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
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

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={handleBack} disabled={isPending}>
          {t('back')}
        </Button>
        <Button type="submit" loading={isPending}>
          {t('next')}
        </Button>
      </div>
    </form>
  );
}
