'use client';

import { useState, useTransition } from 'react';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle2, GraduationCap, Presentation } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { LOCALES } from '@/lib/i18n/config';
import { TEACHING_LANGUAGES } from '../lib/languages';
import { LocaleSelect } from './locale-select';
import { TimezoneSelect } from './timezone-select';
import { updateProfileAction } from '../api/update-profile';
import { updateProfileSchema, type UpdateProfileInput } from '../schemas';
import { createStudentProfileAction } from '../actions/create-student-profile';
import { createTutorProfileAction } from '../actions/create-tutor-profile';

type OnboardingWizardProps = {
  role: 'student' | 'tutor';
  initialDisplayName: string;
  initialLocale: string;
  initialTimezone: string;
};

type Step = 1 | 2 | 3;

// ─── Step 3 schemas ─────────────────────────────────────────────────────────
// (Step 2 uses UpdateProfileInput / updateProfileSchema directly)

const studentPrefsSchema = z.object({
  nativeLanguage: z.string().min(1, 'Native language is required'),
  targetLanguages: z.array(z.string()).min(1, 'Select at least one target language'),
});
type StudentPrefsForm = z.infer<typeof studentPrefsSchema>;

const tutorPrefsSchema = z.object({
  teachingLanguages: z.array(z.string()).min(1, 'Select at least one teaching language'),
  hourlyRate: z.string().optional(),
  currency: z.string().optional(),
});
type TutorPrefsForm = z.infer<typeof tutorPrefsSchema>;

// ─── Root wizard ─────────────────────────────────────────────────────────────

export function OnboardingWizard({
  role,
  initialDisplayName,
  initialLocale,
  initialTimezone,
}: OnboardingWizardProps) {
  const t = useTranslations('Onboarding');
  const [step, setStep] = useState<Step>(1);

  const stepLabels = [t('steps.role'), t('steps.profile'), t('steps.preferences')];

  return (
    <div className="space-y-8">
      {/* Progress */}
      <div>
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted) mt-1">{t('subtitle')}</p>
      </div>

      <div className="flex items-center gap-2">
        {stepLabels.map((label, i) => {
          const num = (i + 1) as Step;
          const done = step > num;
          const active = step === num;
          return (
            <div key={num} className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  done
                    ? 'bg-(--ssz-accent) text-white'
                    : active
                      ? 'bg-(--ssz-accent) text-white'
                      : 'bg-(--ssz-bg-muted) text-(--ssz-text-muted)',
                ].join(' ')}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : num}
              </div>
              <span
                className={[
                  'text-xs truncate hidden sm:block',
                  active ? 'text-(--ssz-text-primary) font-medium' : 'text-(--ssz-text-muted)',
                ].join(' ')}
              >
                {label}
              </span>
              {i < stepLabels.length - 1 && (
                <div className="flex-1 h-px bg-(--ssz-border-base) ml-2" />
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-(--ssz-bg-raised) rounded-(--ssz-radius-lg) border border-(--ssz-border-base) p-6">
        {step === 1 && (
          <StepRoleConfirm role={role} onContinue={() => setStep(2)} />
        )}
        {step === 2 && (
          <StepBaseProfile
            initialDisplayName={initialDisplayName}
            initialLocale={initialLocale}
            initialTimezone={initialTimezone}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}
        {step === 3 && role === 'student' && (
          <StepStudentPrefs onBack={() => setStep(2)} />
        )}
        {step === 3 && role === 'tutor' && (
          <StepTutorPrefs onBack={() => setStep(2)} />
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Role confirm ─────────────────────────────────────────────────────

function StepRoleConfirm({
  role,
  onContinue,
}: {
  role: 'student' | 'tutor';
  onContinue: () => void;
}) {
  const t = useTranslations('Onboarding.role');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-(--ssz-text-muted) mt-1">{t('subtitle')}</p>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-(--ssz-radius-md) border border-(--ssz-accent) bg-(--ssz-accent)/5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--ssz-accent)/10 text-(--ssz-accent)">
          {role === 'student' ? (
            <GraduationCap className="h-5 w-5" />
          ) : (
            <Presentation className="h-5 w-5" />
          )}
        </div>
        <div>
          <p className="font-medium text-(--ssz-text-primary)">
            {role === 'student' ? t('student') : t('tutor')}
          </p>
          <p className="text-xs text-(--ssz-text-muted)">{t('roleNote')}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinue}>{t('continue')}</Button>
      </div>
    </div>
  );
}

// ─── Step 2: Base profile ─────────────────────────────────────────────────────

function StepBaseProfile({
  initialDisplayName,
  initialLocale,
  initialTimezone,
  onBack,
  onContinue,
}: {
  initialDisplayName: string;
  initialLocale: string;
  initialTimezone: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations('Onboarding.baseProfile');
  const tErrors = useTranslations('Errors');
  const [isPending, startTransition] = useTransition();

  const { register, control, handleSubmit, formState: { errors } } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: initialDisplayName,
      uiLocale: (LOCALES.includes(initialLocale as (typeof LOCALES)[number])
        ? initialLocale
        : 'en') as UpdateProfileInput['uiLocale'],
      timezone: initialTimezone || 'UTC',
      bio: null,
      instructionLocales: [],
      contactEmail: null,
      contactPhone: null,
    },
  });

  function onSubmit(data: UpdateProfileInput) {
    startTransition(async () => {
      const result = await updateProfileAction(data);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      onContinue();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-(--ssz-text-muted) mt-1">{t('subtitle')}</p>
      </div>

      <Field
        label={t('displayName')}
        htmlFor="displayName"
        error={errors.displayName?.message}
        required
      >
        <Input
          id="displayName"
          autoComplete="name"
          placeholder={t('displayNamePlaceholder')}
          hasError={!!errors.displayName}
          disabled={isPending}
          {...register('displayName')}
        />
      </Field>

      <Field label={t('uiLocale')} htmlFor="uiLocale" error={errors.uiLocale?.message} required>
        <LocaleSelect name="uiLocale" control={control} disabled={isPending} />
      </Field>

      <Field label={t('timezone')} htmlFor="timezone" error={errors.timezone?.message} required>
        <TimezoneSelect control={control} disabled={isPending} />
      </Field>

      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isPending}>
          {t('back')}
        </Button>
        <Button type="submit" loading={isPending}>
          {t('continue')}
        </Button>
      </div>
    </form>
  );
}

// ─── Step 3a: Student preferences ────────────────────────────────────────────

function StepStudentPrefs({ onBack }: { onBack: () => void }) {
  const t = useTranslations('Onboarding.studentPrefs');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { control, handleSubmit, formState: { errors } } = useForm<StudentPrefsForm>({
    resolver: zodResolver(studentPrefsSchema),
    defaultValues: { nativeLanguage: '', targetLanguages: [] },
  });

  const nativeLangField = useController({ name: 'nativeLanguage', control });
  const targetLangsField = useController({ name: 'targetLanguages', control });

  function onSubmit(data: StudentPrefsForm) {
    startTransition(async () => {
      const result = await createStudentProfileAction({
        nativeLanguage: data.nativeLanguage,
        targetLanguages: data.targetLanguages,
      });
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      router.push(`/${locale}/student/dashboard`);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-(--ssz-text-muted) mt-1">{t('subtitle')}</p>
      </div>

      <LanguageSelectField
        value={nativeLangField.field.value}
        onChange={nativeLangField.field.onChange}
        label={t('nativeLanguage')}
        placeholder={t('nativeLanguagePlaceholder')}
        error={errors.nativeLanguage?.message}
        disabled={isPending}
      />

      <LanguageMultiField
        value={targetLangsField.field.value}
        onChange={targetLangsField.field.onChange}
        label={t('targetLanguages')}
        helpText={t('targetLanguagesHelp')}
        error={errors.targetLanguages?.message}
        disabled={isPending}
      />

      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isPending}>
          {t('back')}
        </Button>
        <Button type="submit" loading={isPending}>
          {t('complete')}
        </Button>
      </div>
    </form>
  );
}

// ─── Step 3b: Tutor preferences ───────────────────────────────────────────────

function StepTutorPrefs({ onBack }: { onBack: () => void }) {
  const t = useTranslations('Onboarding.tutorPrefs');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { register, control, handleSubmit, formState: { errors } } = useForm<TutorPrefsForm>({
    resolver: zodResolver(tutorPrefsSchema),
    defaultValues: { teachingLanguages: [], hourlyRate: '', currency: 'NOK' },
  });

  const teachingLangsField = useController({ name: 'teachingLanguages', control });

  function onSubmit(data: TutorPrefsForm) {
    startTransition(async () => {
      const hourlyRate = data.hourlyRate ? Number(data.hourlyRate) : null;
      const result = await createTutorProfileAction({
        teachingLanguages: data.teachingLanguages,
        hourlyRate: hourlyRate && !isNaN(hourlyRate) ? hourlyRate : null,
        currency: data.currency || null,
      });
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      router.push(`/${locale}/school/dashboard`);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-(--ssz-text-muted) mt-1">{t('subtitle')}</p>
      </div>

      <LanguageMultiField
        value={teachingLangsField.field.value}
        onChange={teachingLangsField.field.onChange}
        label={t('teachingLanguages')}
        helpText={t('teachingLanguagesHelp')}
        error={errors.teachingLanguages?.message}
        disabled={isPending}
      />

      <div className="flex gap-3">
        <Field
          label={t('hourlyRate')}
          htmlFor="hourlyRate"
          error={errors.hourlyRate?.message}
          className="flex-1"
        >
          <Input
            id="hourlyRate"
            type="number"
            min="0"
            step="1"
            placeholder={t('hourlyRatePlaceholder')}
            disabled={isPending}
            {...register('hourlyRate')}
          />
        </Field>

        <Field label={t('currency')} htmlFor="currency" className="w-28">
          <Input id="currency" disabled={isPending} {...register('currency')} />
        </Field>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isPending}>
          {t('back')}
        </Button>
        <Button type="submit" loading={isPending}>
          {t('complete')}
        </Button>
      </div>
    </form>
  );
}

// ─── Shared language field components ────────────────────────────────────────

type LanguageSelectFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  error?: string;
  disabled?: boolean;
};

function LanguageSelectField({
  value,
  onChange,
  label,
  placeholder,
  error,
  disabled,
}: LanguageSelectFieldProps) {
  return (
    <Field label={label} htmlFor="nativeLanguage" error={error} required>
      <select
        id="nativeLanguage"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={[
          'flex h-10 w-full rounded-(--ssz-radius-md) border border-(--ssz-border-base)',
          'bg-(--ssz-bg-base) px-3 py-2 text-sm text-(--ssz-text-primary)',
          'focus:outline-none focus:ring-2 focus:ring-(--ssz-accent)/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-(--ssz-destructive)' : '',
        ].join(' ')}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {TEACHING_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

type LanguageMultiFieldProps = {
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  helpText: string;
  error?: string;
  disabled?: boolean;
};

function LanguageMultiField({ value, onChange, label, helpText, error, disabled }: LanguageMultiFieldProps) {
  const selected = value ?? [];

  function toggle(code: string) {
    onChange(selected.includes(code) ? selected.filter((l) => l !== code) : [...selected, code]);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-(--ssz-text-primary)">{label}</legend>
      <p className="text-xs text-(--ssz-text-muted)">{helpText}</p>
      <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
        {TEACHING_LANGUAGES.map((lang) => (
          <label key={lang.code} className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={selected.includes(lang.code)}
              onCheckedChange={() => toggle(lang.code)}
              disabled={disabled}
            />
            <span className="text-sm">{lang.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-(--ssz-destructive)">{error}</p>}
    </fieldset>
  );
}
