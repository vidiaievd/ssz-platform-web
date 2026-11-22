import { describe, expect, it } from 'vitest';

import type { Entitlements } from '../types';

import { trialDaysLeft } from './trial';

const NOW = new Date('2026-11-22T12:00:00.000Z');

function rights(subscription: Entitlements['subscription']): Entitlements {
  return {
    account: { type: 'workspace', externalId: 'f17c0fb5-0000-4000-8000-000000000000' },
    subscription,
    features: {},
    validUntil: '2026-12-01T00:00:00.000Z',
    version: 1,
  };
}

describe('trialDaysLeft', () => {
  it('counts the days left on a trial, a part of a day as a whole one', () => {
    expect(trialDaysLeft(rights({ status: 'trial', periodEnd: '2026-12-06T00:00:00.000Z' }), NOW)).toBe(14);
  });

  it('reads 1 on the last day, never 0', () => {
    expect(trialDaysLeft(rights({ status: 'trial', periodEnd: '2026-11-22T12:00:01.000Z' }), NOW)).toBe(1);
  });

  it('announces nothing once the trial has ended', () => {
    expect(trialDaysLeft(rights({ status: 'trial', periodEnd: '2026-11-22T12:00:00.000Z' }), NOW)).toBeNull();
  });

  it('announces nothing for a paid subscription', () => {
    expect(trialDaysLeft(rights({ status: 'active', periodEnd: '2026-12-06T00:00:00.000Z' }), NOW)).toBeNull();
  });

  it('announces nothing on the free plan or with no rights read', () => {
    expect(trialDaysLeft(rights(null), NOW)).toBeNull();
    expect(trialDaysLeft(null, NOW)).toBeNull();
  });

  it('announces nothing for a trial without an end', () => {
    expect(trialDaysLeft(rights({ status: 'trial', periodEnd: null }), NOW)).toBeNull();
  });
});
