// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { onboardingSteps, canTransition, resolveNextStatus, canReusePlatform } from './status';
import { DEFAULT_ONBOARDING_SETTINGS, resolveOnboardingSettings } from './settings-defaults';
import type { Membership, PlacementResult } from '@/features/enrollment/types';

const baseMembership: Membership = {
  id: 'm1',
  schoolSlug: 'test-school',
  schoolName: 'Test School',
  status: 'onboarding',
  source: 'public-apply',
  language: 'nb',
  createdAt: '2026-01-01',
};

const platformResult: PlacementResult = {
  language: 'nb',
  cefrLevel: 'B1',
  score: 72,
  takenAt: '2025-12-01',
  scope: 'platform',
  sourceLabel: 'platform',
};

// ── onboardingSteps ───────────────────────────────────────────────────────────

describe('onboardingSteps', () => {
  it('default settings produce placement + availability + interview', () => {
    expect(onboardingSteps(DEFAULT_ONBOARDING_SETTINGS)).toEqual([
      'placement',
      'availability',
      'interview',
    ]);
  });

  it('placement.mode=none removes placement step', () => {
    const s = resolveOnboardingSettings({ placement: { mode: 'none', reusePlatformResult: false } });
    expect(onboardingSteps(s)).not.toContain('placement');
  });

  it('open-school shortcut (none + !required + !collect) → no steps', () => {
    const s = resolveOnboardingSettings({
      placement: { mode: 'none', reusePlatformResult: false },
      interview: { required: false, autoPlaceByScore: false },
      availability: { collect: false },
      ageBands: { values: [], collect: false },
    });
    expect(onboardingSteps(s)).toHaveLength(0);
  });

  it('ageBands.collect=true adds ageBand step after availability', () => {
    const s = resolveOnboardingSettings({ ageBands: { values: ['kids', 'teens'], collect: true } });
    expect(onboardingSteps(s)).toEqual([
      'placement',
      'availability',
      'ageBand',
      'interview',
    ]);
  });
});

// ── canTransition ─────────────────────────────────────────────────────────────

describe('canTransition', () => {
  it('pending → onboarding allowed', () => expect(canTransition('pending', 'onboarding')).toBe(true));
  it('pending → rejected allowed', () => expect(canTransition('pending', 'rejected')).toBe(true));
  it('active → left allowed', () => expect(canTransition('active', 'left')).toBe(true));
  it('active → pending NOT allowed', () => expect(canTransition('active', 'pending')).toBe(false));
  it('rejected → active NOT allowed', () => expect(canTransition('rejected', 'active')).toBe(false));
  it('onboarding → active allowed (auto-place shortcut)', () =>
    expect(canTransition('onboarding', 'active')).toBe(true));
});

// ── resolveNextStatus ─────────────────────────────────────────────────────────

describe('resolveNextStatus', () => {
  it('interview required → placement-review', () => {
    expect(resolveNextStatus(baseMembership, DEFAULT_ONBOARDING_SETTINGS)).toBe('placement-review');
  });

  it('autoPlaceByScore && !required → active (bypasses placement-review)', () => {
    const s = resolveOnboardingSettings({
      interview: { required: false, autoPlaceByScore: true },
    });
    expect(resolveNextStatus(baseMembership, s)).toBe('active');
  });

  it('!required && !autoPlaceByScore → active', () => {
    const s = resolveOnboardingSettings({
      interview: { required: false, autoPlaceByScore: false },
    });
    expect(resolveNextStatus(baseMembership, s)).toBe('active');
  });
});

// ── canReusePlatform ──────────────────────────────────────────────────────────

describe('canReusePlatform', () => {
  it('returns false when reusePlatformResult=false', () => {
    const s = resolveOnboardingSettings({ placement: { mode: 'platform', reusePlatformResult: false } });
    expect(canReusePlatform(platformResult, s, '2026-06-15')).toBe(false);
  });

  it('returns false when no result provided', () => {
    expect(canReusePlatform(undefined, DEFAULT_ONBOARDING_SETTINGS, '2026-06-15')).toBe(false);
  });

  it('returns true when result is within maxResultAgeDays', () => {
    // takenAt: 2025-12-01, now: 2026-06-15 = ~196 days < 365
    expect(canReusePlatform(platformResult, DEFAULT_ONBOARDING_SETTINGS, '2026-06-15')).toBe(true);
  });

  it('returns false when result is older than maxResultAgeDays', () => {
    const oldResult: PlacementResult = { ...platformResult, takenAt: '2024-01-01' };
    // 2024-01-01 to 2026-06-15 = ~897 days > 365
    expect(canReusePlatform(oldResult, DEFAULT_ONBOARDING_SETTINGS, '2026-06-15')).toBe(false);
  });

  it('returns true when no maxResultAgeDays limit set', () => {
    const s = resolveOnboardingSettings({
      placement: { mode: 'platform', reusePlatformResult: true, maxResultAgeDays: undefined },
    });
    const veryOld: PlacementResult = { ...platformResult, takenAt: '2020-01-01' };
    expect(canReusePlatform(veryOld, s, '2026-06-15')).toBe(true);
  });
});
