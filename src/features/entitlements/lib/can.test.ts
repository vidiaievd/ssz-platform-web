import { describe, expect, it } from 'vitest';

import type { Entitlements } from '../types';
import { can } from './can';

function rights(features: Entitlements['features']): Entitlements {
  return {
    account: { type: 'workspace', externalId: 'w1' },
    features,
    validUntil: '2026-11-21T00:00:00.000Z',
    version: 2,
  };
}

describe('can', () => {
  it('answers yes for an enabled key', () => {
    const e = rights({ 'ai.review_draft': { enabled: true, monthlyCredits: '1000', limits: {} } });
    expect(can(e, 'ai.review_draft')).toBe(true);
  });

  it('answers no for a key the plan carries switched off', () => {
    const e = rights({ 'ai.review_draft': { enabled: false, monthlyCredits: null, limits: {} } });
    expect(can(e, 'ai.review_draft')).toBe(false);
  });

  it('answers no for a key the plan does not carry', () => {
    const e = rights({ 'ai.review_draft': { enabled: true, monthlyCredits: '1000', limits: {} } });
    expect(can(e, 'ai.authoring')).toBe(false);
  });

  it('answers no when the rights are unknown', () => {
    expect(can(null, 'ai.review_draft')).toBe(false);
  });
});
