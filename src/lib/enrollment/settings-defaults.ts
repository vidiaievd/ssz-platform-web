import type { SchoolOnboardingSettings } from '@/features/enrollment/types';

export const DEFAULT_ONBOARDING_SETTINGS: SchoolOnboardingSettings = {
  placement: { mode: 'platform', reusePlatformResult: true, maxResultAgeDays: 365 },
  interview: { required: true, autoPlaceByScore: false },
  availability: { collect: true },
  ageBands: { values: [], collect: false },
  approval: { mode: 'manual' },
};

export function resolveOnboardingSettings(
  partial?: Partial<SchoolOnboardingSettings>,
): SchoolOnboardingSettings {
  if (!partial) return DEFAULT_ONBOARDING_SETTINGS;
  return {
    placement: { ...DEFAULT_ONBOARDING_SETTINGS.placement, ...partial.placement },
    interview: { ...DEFAULT_ONBOARDING_SETTINGS.interview, ...partial.interview },
    availability: { ...DEFAULT_ONBOARDING_SETTINGS.availability, ...partial.availability },
    ageBands: { ...DEFAULT_ONBOARDING_SETTINGS.ageBands, ...partial.ageBands },
    approval: { ...DEFAULT_ONBOARDING_SETTINGS.approval, ...partial.approval },
  };
}
