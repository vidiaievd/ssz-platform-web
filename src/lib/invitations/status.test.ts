// @vitest-environment node

import { describe, it, expect } from 'vitest';

import {
  deriveInvitationStatus,
  isExpiringSoon,
  expiryLabelKind,
  canResend,
  resendCooldownRemaining,
  audiencePredicate,
  isActionable,
} from './status';

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000; // fixed epoch for determinism

function isoFuture(ms: number): string {
  return new Date(NOW + ms).toISOString();
}

function isoPast(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

const DAY = 24 * 60 * 60 * 1000;

// ── deriveInvitationStatus ────────────────────────────────────────────────────

describe('deriveInvitationStatus', () => {
  it('returns "accepted" when acceptedAt is set (highest priority)', () => {
    expect(
      deriveInvitationStatus(
        { acceptedAt: isoPast(DAY), expiresAt: isoPast(DAY * 2), revoked: true },
        NOW,
      ),
    ).toBe('accepted');
  });

  it('returns "revoked" when revoked=true and not accepted', () => {
    expect(
      deriveInvitationStatus(
        { acceptedAt: null, expiresAt: isoFuture(DAY), revoked: true },
        NOW,
      ),
    ).toBe('revoked');
  });

  it('returns "expired" when expiresAt is in the past and not accepted/revoked', () => {
    expect(
      deriveInvitationStatus(
        { acceptedAt: null, expiresAt: isoPast(DAY), revoked: false },
        NOW,
      ),
    ).toBe('expired');
  });

  it('returns "pending" when expiresAt is in the future', () => {
    expect(
      deriveInvitationStatus(
        { acceptedAt: null, expiresAt: isoFuture(DAY) },
        NOW,
      ),
    ).toBe('pending');
  });
});

// ── isExpiringSoon ────────────────────────────────────────────────────────────

describe('isExpiringSoon', () => {
  it('returns true within 2 days', () => {
    expect(
      isExpiringSoon(
        { expiresAt: isoFuture(DAY), acceptedAt: null, status: 'pending' },
        2,
        NOW,
      ),
    ).toBe(true);
  });

  it('returns false beyond 2 days', () => {
    expect(
      isExpiringSoon(
        { expiresAt: isoFuture(DAY * 10), acceptedAt: null, status: 'pending' },
        2,
        NOW,
      ),
    ).toBe(false);
  });

  it('returns false exactly at the 2-day boundary (edge)', () => {
    expect(
      isExpiringSoon(
        { expiresAt: isoFuture(2 * DAY + 1), acceptedAt: null, status: 'pending' },
        2,
        NOW,
      ),
    ).toBe(false);
  });

  it('returns false for accepted invitations', () => {
    expect(
      isExpiringSoon(
        { expiresAt: isoFuture(DAY), acceptedAt: isoPast(DAY), status: 'accepted' },
        2,
        NOW,
      ),
    ).toBe(false);
  });

  it('returns false for expired invitations', () => {
    expect(
      isExpiringSoon(
        { expiresAt: isoPast(DAY), acceptedAt: null, status: 'expired' },
        2,
        NOW,
      ),
    ).toBe(false);
  });
});

// ── expiryLabelKind ───────────────────────────────────────────────────────────

describe('expiryLabelKind', () => {
  it('returns "dash" for accepted', () => {
    expect(
      expiryLabelKind(
        { expiresAt: isoFuture(DAY), acceptedAt: isoPast(1000), status: 'accepted' },
        NOW,
      ),
    ).toBe('dash');
  });

  it('returns "expired" when past expiry', () => {
    expect(
      expiryLabelKind(
        { expiresAt: isoPast(DAY), acceptedAt: null, status: 'expired' },
        NOW,
      ),
    ).toBe('expired');
  });

  it('returns "soon" within 2 days', () => {
    expect(
      expiryLabelKind(
        { expiresAt: isoFuture(DAY), acceptedAt: null, status: 'pending' },
        NOW,
      ),
    ).toBe('soon');
  });

  it('returns "days" beyond 2 days', () => {
    expect(
      expiryLabelKind(
        { expiresAt: isoFuture(DAY * 5), acceptedAt: null, status: 'pending' },
        NOW,
      ),
    ).toBe('days');
  });
});

// ── canResend ─────────────────────────────────────────────────────────────────

describe('canResend', () => {
  it('returns true after cooldown', () => {
    expect(
      canResend(
        { lastSentAt: isoPast(200_000), status: 'pending' },
        120_000,
        NOW,
      ),
    ).toBe(true);
  });

  it('returns false within cooldown', () => {
    expect(
      canResend(
        { lastSentAt: isoPast(60_000), status: 'pending' },
        120_000,
        NOW,
      ),
    ).toBe(false);
  });

  it('returns false for accepted status', () => {
    expect(
      canResend(
        { lastSentAt: isoPast(200_000), status: 'accepted' },
        120_000,
        NOW,
      ),
    ).toBe(false);
  });

  it('returns false for revoked status', () => {
    expect(
      canResend(
        { lastSentAt: isoPast(200_000), status: 'revoked' },
        120_000,
        NOW,
      ),
    ).toBe(false);
  });
});

describe('resendCooldownRemaining', () => {
  it('returns remaining ms when inside cooldown', () => {
    const remaining = resendCooldownRemaining(
      { lastSentAt: isoPast(60_000) },
      120_000,
      NOW,
    );
    expect(remaining).toBe(60_000);
  });

  it('returns 0 when cooldown has passed', () => {
    expect(
      resendCooldownRemaining(
        { lastSentAt: isoPast(200_000) },
        120_000,
        NOW,
      ),
    ).toBe(0);
  });
});

// ── audiencePredicate ─────────────────────────────────────────────────────────

describe('audiencePredicate', () => {
  it('"teachers" matches only TEACHER', () => {
    const pred = audiencePredicate('teachers');
    expect(pred({ role: 'TEACHER' })).toBe(true);
    expect(pred({ role: 'STUDENT' })).toBe(false);
    expect(pred({ role: 'ADMIN' })).toBe(false);
  });

  it('"students" matches only STUDENT', () => {
    const pred = audiencePredicate('students');
    expect(pred({ role: 'STUDENT' })).toBe(true);
    expect(pred({ role: 'TEACHER' })).toBe(false);
  });

  it('"staff" matches ADMIN, CONTENT_ADMIN, SCHEDULER — not TEACHER or STUDENT', () => {
    const pred = audiencePredicate('staff');
    expect(pred({ role: 'ADMIN' })).toBe(true);
    expect(pred({ role: 'CONTENT_ADMIN' })).toBe(true);
    expect(pred({ role: 'SCHEDULER' })).toBe(true);
    expect(pred({ role: 'TEACHER' })).toBe(false);
    expect(pred({ role: 'STUDENT' })).toBe(false);
  });

  it('"all" matches every role', () => {
    const pred = audiencePredicate('all');
    expect(pred({ role: 'TEACHER' })).toBe(true);
    expect(pred({ role: 'STUDENT' })).toBe(true);
    expect(pred({ role: 'ADMIN' })).toBe(true);
  });
});

// ── isActionable ──────────────────────────────────────────────────────────────

describe('isActionable', () => {
  it('returns true for pending', () => {
    expect(isActionable({ status: 'pending' })).toBe(true);
  });

  it('returns true for expired', () => {
    expect(isActionable({ status: 'expired' })).toBe(true);
  });

  it('returns false for accepted', () => {
    expect(isActionable({ status: 'accepted' })).toBe(false);
  });

  it('returns false for revoked', () => {
    expect(isActionable({ status: 'revoked' })).toBe(false);
  });
});
