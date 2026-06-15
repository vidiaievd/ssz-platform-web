// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { DEFAULT_ONBOARDING_SETTINGS, resolveOnboardingSettings } from './settings-defaults';

describe('resolveOnboardingSettings', () => {
  it('returns defaults when called with no argument', () => {
    expect(resolveOnboardingSettings()).toEqual(DEFAULT_ONBOARDING_SETTINGS);
  });

  it('deep-merges a partial override without losing untouched defaults', () => {
    const result = resolveOnboardingSettings({
      interview: { required: false, autoPlaceByScore: true },
    });
    expect(result.interview).toEqual({ required: false, autoPlaceByScore: true });
    // untouched sections remain at defaults
    expect(result.placement).toEqual(DEFAULT_ONBOARDING_SETTINGS.placement);
    expect(result.availability).toEqual(DEFAULT_ONBOARDING_SETTINGS.availability);
    expect(result.approval).toEqual(DEFAULT_ONBOARDING_SETTINGS.approval);
  });

  it('overrides placement mode while keeping other placement fields', () => {
    const result = resolveOnboardingSettings({ placement: { mode: 'none', reusePlatformResult: false } });
    expect(result.placement.mode).toBe('none');
    expect(result.placement.reusePlatformResult).toBe(false);
    // maxResultAgeDays falls back to default
    expect(result.placement.maxResultAgeDays).toBe(365);
  });

  it('supports auto approval mode override', () => {
    const result = resolveOnboardingSettings({ approval: { mode: 'auto' } });
    expect(result.approval.mode).toBe('auto');
  });
});
