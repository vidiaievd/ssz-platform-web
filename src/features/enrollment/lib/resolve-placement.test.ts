// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { resolvePlacement } from './resolve-placement';
import { resolveOnboardingSettings } from '@/lib/enrollment/settings-defaults';
import type { PlacementResult } from '@/features/enrollment/types';

const NOW = '2026-06-15';

const platformResult: PlacementResult = {
  language: 'nb',
  cefrLevel: 'B1',
  score: 72,
  takenAt: '2026-01-01',
  scope: 'platform',
  sourceLabel: 'platform',
};

describe('resolvePlacement', () => {
  it('mode=none → skip regardless of results', () => {
    const s = resolveOnboardingSettings({
      placement: { mode: 'none', reusePlatformResult: false },
    });
    expect(resolvePlacement([platformResult], 'nb', s, NOW)).toEqual({ action: 'skip' });
  });

  it('mode=platform + reuse + fresh → reuse', () => {
    const s = resolveOnboardingSettings({
      placement: { mode: 'platform', reusePlatformResult: true, maxResultAgeDays: 365 },
    });
    const decision = resolvePlacement([platformResult], 'nb', s, NOW);
    expect(decision.action).toBe('reuse');
    if (decision.action === 'reuse') {
      expect(decision.result.cefrLevel).toBe('B1');
    }
  });

  it('mode=platform + reuse=false → take-platform', () => {
    const s = resolveOnboardingSettings({
      placement: { mode: 'platform', reusePlatformResult: false },
    });
    expect(resolvePlacement([platformResult], 'nb', s, NOW)).toEqual({ action: 'take-platform' });
  });

  it('mode=platform + no result → take-platform', () => {
    const s = resolveOnboardingSettings({
      placement: { mode: 'platform', reusePlatformResult: true },
    });
    expect(resolvePlacement([], 'nb', s, NOW)).toEqual({ action: 'take-platform' });
  });

  it('mode=platform + stale result → take-platform', () => {
    const stale: PlacementResult = { ...platformResult, takenAt: '2020-01-01' };
    const s = resolveOnboardingSettings({
      placement: { mode: 'platform', reusePlatformResult: true, maxResultAgeDays: 365 },
    });
    expect(resolvePlacement([stale], 'nb', s, NOW)).toEqual({ action: 'take-platform' });
  });

  it('mode=school → always take-school', () => {
    const s = resolveOnboardingSettings({
      placement: { mode: 'school', reusePlatformResult: true, schoolTestId: 'test-1' },
    });
    expect(resolvePlacement([platformResult], 'nb', s, NOW)).toEqual({ action: 'take-school' });
  });

  it('does not match results for a different language', () => {
    const s = resolveOnboardingSettings({
      placement: { mode: 'platform', reusePlatformResult: true },
    });
    // platformResult is for 'nb', querying for 'en' → no result → take-platform
    expect(resolvePlacement([platformResult], 'en', s, NOW)).toEqual({ action: 'take-platform' });
  });
});
