import { describe, expect, it } from 'vitest';

import { authRefusalOf } from './auth-refusal';

describe('authRefusalOf', () => {
  it('names a blocked account', () => {
    expect(authRefusalOf({ details: { code: 'ACCOUNT_BLOCKED' } })).toEqual({ kind: 'blocked' });
  });

  it('keeps the end of a lockout', () => {
    expect(
      authRefusalOf({ details: { code: 'ACCOUNT_LOCKED', lockedUntil: '2026-11-18T17:30:04Z' } }),
    ).toEqual({ kind: 'locked', lockedUntil: '2026-11-18T17:30:04Z' });
  });

  it('answers a lockout without an end with null', () => {
    expect(authRefusalOf({ details: { code: 'ACCOUNT_LOCKED', lockedUntil: null } })).toEqual({
      kind: 'locked',
      lockedUntil: null,
    });
  });

  it('names an unverified email and a wrong code', () => {
    expect(authRefusalOf({ details: { code: 'EMAIL_NOT_VERIFIED' } })?.kind).toBe(
      'email_not_verified',
    );
    expect(authRefusalOf({ details: { code: 'INVALID_TOTP_CODE' } })?.kind).toBe('invalid_code');
  });

  it('is null for anything else', () => {
    expect(authRefusalOf({ details: { code: 'INVALID_CREDENTIALS' } })).toBeNull();
    expect(authRefusalOf({ details: null })).toBeNull();
    expect(authRefusalOf({ details: 'oops' })).toBeNull();
    expect(authRefusalOf(undefined)).toBeNull();
  });
});
