import { describe, expect, it } from 'vitest';

import type { ReviewSubmission } from '../types';

import { untilLinksExpire } from './use-submission';

const NOW = Date.parse('2026-10-07T10:00:00.000Z');

const withLinks = (...expiries: string[]) =>
  ({
    playback: Object.fromEntries(
      expiries.map((expiresAt, i) => [
        `a${i}`,
        { url: 'u', mimeType: 'audio/mpeg', expiresAt, durationMs: null, peaks: null },
      ]),
    ),
  }) as unknown as ReviewSubmission;

describe('untilLinksExpire (plan 70, phase 9.1)', () => {
  it('refetches a minute before the first link expires', () => {
    const submission = withLinks('2026-10-07T11:00:00.000Z', '2026-10-07T10:30:00.000Z');
    expect(untilLinksExpire(submission, NOW)).toBe(29 * 60_000);
  });

  it('never polls faster than every fifteen seconds', () => {
    expect(untilLinksExpire(withLinks('2026-10-07T10:00:30.000Z'), NOW)).toBe(15_000);
  });

  it('does not poll a submission without links', () => {
    expect(untilLinksExpire(undefined, NOW)).toBe(false);
    expect(untilLinksExpire({ playback: null } as unknown as ReviewSubmission, NOW)).toBe(false);
    expect(untilLinksExpire(withLinks(), NOW)).toBe(false);
  });
});
