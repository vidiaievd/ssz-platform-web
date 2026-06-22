'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { onboardingSteps } from '@/lib/enrollment/status';
import { onboardingSettingsSchema, type OnboardingSettingsInput } from '@/features/enrollment/schemas/onboarding-settings';
import type { SchoolOnboardingSettings } from '@/features/enrollment/types';

type Props = {
  schoolSlug: string;
  initialSettings: SchoolOnboardingSettings;
};

const STEP_LABELS: Record<string, string> = {
  placement: 'Placement test',
  availability: 'Availability',
  interview: 'Interview',
};

export function OnboardingSettingsForm({ schoolSlug, initialSettings }: Props) {
  const t = useTranslations('Enrollment.Settings');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, isDirty, errors },
    reset,
  } = useForm<OnboardingSettingsInput>({
    resolver: zodResolver(onboardingSettingsSchema),
    defaultValues: initialSettings,
  });

  // Reset dirty state when initial settings change (e.g. after save)
  useEffect(() => {
    void (async () => {
      reset(initialSettings);
    })();
  }, [initialSettings, reset]);

  const watchedSettings = watch();
  const previewSteps = onboardingSteps(watchedSettings as SchoolOnboardingSettings);

  async function onSubmit(data: OnboardingSettingsInput) {
    const res = await fetch(`/api/enrollment/schools/${schoolSlug}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      toast.error(t('saveFailed'));
      return;
    }
    toast.success(t('saved'));
    reset(data);
  }

  const placementMode = watch('placement.mode');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8 max-w-lg">
      {/* ── Placement ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
          {t('sectionPlacement')}
        </h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="placement-mode">{t('placementMode')}</Label>
          <Select
            value={placementMode}
            onValueChange={(v) =>
              setValue('placement.mode', v as OnboardingSettingsInput['placement']['mode'], {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger id="placement-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="platform">{t('placementPlatform')}</SelectItem>
              <SelectItem value="school">{t('placementSchool')}</SelectItem>
              <SelectItem value="none">{t('placementNone')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {placementMode === 'platform' && (
          <>
            <div className="flex items-center justify-between">
              <Label htmlFor="reuse-platform">{t('reusePlatformResult')}</Label>
              <Switch
                id="reuse-platform"
                checked={watch('placement.reusePlatformResult')}
                onCheckedChange={(v) =>
                  setValue('placement.reusePlatformResult', v, { shouldDirty: true })
                }
              />
            </div>

            {watch('placement.reusePlatformResult') && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="max-age">{t('maxResultAgeDays')}</Label>
                <Input
                  id="max-age"
                  type="number"
                  min={1}
                  placeholder="365"
                  {...register('placement.maxResultAgeDays', { valueAsNumber: true })}
                  className="max-w-30"
                />
                {errors.placement?.maxResultAgeDays && (
                  <p className="text-xs text-destructive">
                    {errors.placement.maxResultAgeDays.message}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Interview ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
          {t('sectionInterview')}
        </h2>

        <div className="flex items-center justify-between">
          <Label htmlFor="interview-required">{t('interviewRequired')}</Label>
          <Switch
            id="interview-required"
            checked={watch('interview.required')}
            onCheckedChange={(v) =>
              setValue('interview.required', v, { shouldDirty: true })
            }
          />
        </div>

        {!watch('interview.required') && (
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-place">{t('autoPlaceByScore')}</Label>
            <Switch
              id="auto-place"
              checked={watch('interview.autoPlaceByScore')}
              onCheckedChange={(v) =>
                setValue('interview.autoPlaceByScore', v, { shouldDirty: true })
              }
            />
          </div>
        )}
      </section>

      {/* ── Availability ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
          {t('sectionAvailability')}
        </h2>
        <div className="flex items-center justify-between">
          <Label htmlFor="collect-avail">{t('collectAvailability')}</Label>
          <Switch
            id="collect-avail"
            checked={watch('availability.collect')}
            onCheckedChange={(v) =>
              setValue('availability.collect', v, { shouldDirty: true })
            }
          />
        </div>
      </section>

      {/* ── Age bands ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
          {t('sectionAgeBands')}
        </h2>

        <div className="flex flex-col gap-2">
          {(['kids', 'teens', 'adults'] as const).map((band) => {
            const values = watch('ageBands.values');
            const checked = values.includes(band);
            const label =
              band === 'kids'
                ? t('ageBandKids')
                : band === 'teens'
                  ? t('ageBandTeens')
                  : t('ageBandAdults');
            return (
              <div key={band} className="flex items-center gap-2">
                <Checkbox
                  id={`age-band-${band}`}
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = v
                      ? [...values, band]
                      : values.filter((b) => b !== band);
                    setValue('ageBands.values', next, { shouldDirty: true });
                  }}
                />
                <Label htmlFor={`age-band-${band}`}>{label}</Label>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="collect-age-band">{t('collectAgeBand')}</Label>
          <Switch
            id="collect-age-band"
            checked={watch('ageBands.collect')}
            onCheckedChange={(v) => setValue('ageBands.collect', v, { shouldDirty: true })}
          />
        </div>
      </section>

      {/* ── Approval ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
          {t('sectionApproval')}
        </h2>
        <div className="flex items-center justify-between">
          <Label htmlFor="manual-approval">{t('manualApproval')}</Label>
          <Switch
            id="manual-approval"
            checked={watch('approval.mode') === 'manual'}
            onCheckedChange={(v) =>
              setValue('approval.mode', v ? 'manual' : 'auto', { shouldDirty: true })
            }
          />
        </div>
      </section>

      {/* ── Step preview ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-(--ssz-surface-muted) p-4 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
          {t('stepPreviewLabel')}
        </p>
        {previewSteps.length === 0 ? (
          <p className="text-sm text-(--ssz-text-muted)">{t('stepPreviewEmpty')}</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {previewSteps.map((step, i) => (
              <li key={step} className="flex items-center gap-2 text-sm text-(--ssz-text-primary)">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-(--ssz-primary)/15 text-xs font-semibold text-(--ssz-primary)">
                  {i + 1}
                </span>
                {STEP_LABELS[step] ?? step}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
