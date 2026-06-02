// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { decodeJwtPayload } from './decode-jwt';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesig`;
}

describe('decodeJwtPayload', () => {
  it('returns the payload of a well-formed JWT', () => {
    const jwt = makeJwt({ sub: 'user-1', email_verified: true });
    expect(decodeJwtPayload(jwt)).toEqual({ sub: 'user-1', email_verified: true });
  });

  it('returns email_verified: false when present', () => {
    const jwt = makeJwt({ sub: 'user-1', email_verified: false });
    const payload = decodeJwtPayload(jwt);
    expect(payload?.email_verified).toBe(false);
  });

  it('returns null for a plain string (no dots)', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });

  it('returns null for a two-segment string', () => {
    expect(decodeJwtPayload('header.payload')).toBeNull();
  });

  it('returns null for malformed base64url payload', () => {
    expect(decodeJwtPayload('header.!!!.sig')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeJwtPayload('')).toBeNull();
  });
});
