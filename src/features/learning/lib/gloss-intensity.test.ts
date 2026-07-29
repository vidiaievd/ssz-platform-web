import { describe, expect, it } from 'vitest';

import {
  MATURE_STABILITY_DAYS,
  getGlossIntensity,
  resolveGlossIntensity,
} from './gloss-intensity';

describe('getGlossIntensity', () => {
  it('treats a word with no card as new, not as known', () => {
    expect(getGlossIntensity(undefined)).toBe('normal');
  });

  it('marks an explicitly NEW card normally', () => {
    expect(getGlossIntensity('NEW', 0)).toBe('normal');
  });

  it.each(['LEARNING', 'RELEARNING'] as const)('marks a %s card strongly', (state) => {
    expect(getGlossIntensity(state, 1.2)).toBe('strong');
  });

  it('mutes a review card that is not yet mature', () => {
    expect(getGlossIntensity('REVIEW', MATURE_STABILITY_DAYS - 0.1)).toBe('muted');
  });

  it('drops the decoration once stability reaches the maturity threshold', () => {
    expect(getGlossIntensity('REVIEW', MATURE_STABILITY_DAYS)).toBe('none');
    expect(getGlossIntensity('REVIEW', MATURE_STABILITY_DAYS + 100)).toBe('none');
  });

  it('treats a review card with no stability as immature', () => {
    expect(getGlossIntensity('REVIEW')).toBe('muted');
  });

  it('drops the decoration for a suspended card', () => {
    expect(getGlossIntensity('SUSPENDED', 0)).toBe('none');
  });
});

describe('resolveGlossIntensity', () => {
  it('ignores SRS state when everything is shown', () => {
    expect(resolveGlossIntensity('all', 'REVIEW', 100)).toBe('normal');
    expect(resolveGlossIntensity('all', 'LEARNING', 1)).toBe('normal');
  });

  it('decorates nothing when glossing is off', () => {
    expect(resolveGlossIntensity('off', 'LEARNING', 1)).toBe('none');
    expect(resolveGlossIntensity('off', undefined)).toBe('none');
  });

  it('defers to the SRS state when showing unknown words only', () => {
    expect(resolveGlossIntensity('unknown', 'LEARNING', 1)).toBe('strong');
    expect(resolveGlossIntensity('unknown', 'REVIEW', 40)).toBe('none');
    expect(resolveGlossIntensity('unknown', undefined)).toBe('normal');
  });
});
