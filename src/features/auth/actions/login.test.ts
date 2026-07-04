// @vitest-environment node

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';

const mockCookieGet = vi.fn((_: string) => undefined as { value: string } | undefined);
const mockCookieSet = vi.fn();
const mockCookieDelete = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: mockCookieGet,
    set: mockCookieSet,
    delete: mockCookieDelete,
  }),
  headers: async () => new Headers(),
}));

// Imported after vi.mock so shims are in place
const { loginAction, mfaChallengeAction } = await import('./login');

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesig`;
}

const TOKENS = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessTokenExpiresAt: '',
  refreshTokenExpiresAt: '',
};

const ME_RESPONSE = { userId: 'user-1', email: 'user@example.com', roles: ['student'], emailVerified: true };
const PROFILE_NO_PROFILE = { hasStudentProfile: false, hasTutorProfile: false };

describe('loginAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns authenticated stage with roles on success', async () => {
    server.use(
      http.post('http://auth.test/api/v1/auth/login', () => HttpResponse.json(TOKENS)),
      http.get('http://auth.test/api/v1/auth/me', () => HttpResponse.json(ME_RESPONSE)),
      http.get('http://profile.test/api/v1/profiles/me', () => HttpResponse.json(PROFILE_NO_PROFILE)),
    );

    const result = await loginAction({ email: 'user@example.com', password: 'ValidPass1!' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stage).toBe('authenticated');
    if (result.value.stage !== 'authenticated') return;
    expect(result.value.roles).toEqual(['student']);
    expect(result.value.hasStudentProfile).toBe(false);
    expect(result.value.hasTutorProfile).toBe(false);
  });

  it('writes auth cookies on successful login', async () => {
    server.use(
      http.post('http://auth.test/api/v1/auth/login', () => HttpResponse.json(TOKENS)),
      http.get('http://auth.test/api/v1/auth/me', () => HttpResponse.json(ME_RESPONSE)),
      http.get('http://profile.test/api/v1/profiles/me', () => HttpResponse.json(PROFILE_NO_PROFILE)),
    );

    await loginAction({ email: 'user@example.com', password: 'ValidPass1!' });

    expect(mockCookieSet).toHaveBeenCalledWith('ssz_at', 'access-token', expect.any(Object));
    expect(mockCookieSet).toHaveBeenCalledWith('ssz_rt', 'refresh-token', expect.any(Object));
  });

  it('treats 404 from profile as no profile', async () => {
    server.use(
      http.post('http://auth.test/api/v1/auth/login', () => HttpResponse.json(TOKENS)),
      http.get('http://auth.test/api/v1/auth/me', () => HttpResponse.json(ME_RESPONSE)),
      http.get('http://profile.test/api/v1/profiles/me', () => new HttpResponse(null, { status: 404 })),
    );

    const result = await loginAction({ email: 'user@example.com', password: 'ValidPass1!' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (result.value.stage !== 'authenticated') return;
    expect(result.value.hasStudentProfile).toBe(false);
    expect(result.value.hasTutorProfile).toBe(false);
  });

  it('returns err with unauthenticated on 401', async () => {
    server.use(
      http.post('http://auth.test/api/v1/auth/login', () =>
        HttpResponse.json({ title: 'Unauthorized' }, { status: 401 }),
      ),
    );

    const result = await loginAction({ email: 'user@example.com', password: 'WrongPass1!' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unauthenticated');
  });

  it('returns mfa stage on 423 with mfaChallengeToken', async () => {
    server.use(
      http.post('http://auth.test/api/v1/auth/login', () =>
        HttpResponse.json(
          { title: 'MFA Required', mfaChallengeToken: 'challenge-token' },
          { status: 423 },
        ),
      ),
    );

    const result = await loginAction({ email: 'user@example.com', password: 'ValidPass1!' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stage).toBe('mfa');
    if (result.value.stage !== 'mfa') return;
    expect(result.value.mfaChallengeToken).toBe('challenge-token');
  });

  it('returns validation error without hitting the network on invalid input', async () => {
    const result = await loginAction({ email: 'not-an-email', password: '' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
  });

  it('propagates emailVerified: false from a JWT with email_verified: false', async () => {
    const unverifiedToken = fakeJwt({ sub: 'user-1', email_verified: false });
    server.use(
      http.post('http://auth.test/api/v1/auth/login', () =>
        HttpResponse.json({ ...TOKENS, accessToken: unverifiedToken }),
      ),
      http.get('http://auth.test/api/v1/auth/me', () => HttpResponse.json(ME_RESPONSE)),
      http.get('http://profile.test/api/v1/profiles/me', () => HttpResponse.json(PROFILE_NO_PROFILE)),
    );

    const result = await loginAction({ email: 'user@example.com', password: 'ValidPass1!' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (result.value.stage !== 'authenticated') return;
    expect(result.value.emailVerified).toBe(false);
  });

  it('returns emailVerified: undefined when the access token is not a valid JWT', async () => {
    server.use(
      http.post('http://auth.test/api/v1/auth/login', () => HttpResponse.json(TOKENS)),
      http.get('http://auth.test/api/v1/auth/me', () => HttpResponse.json(ME_RESPONSE)),
      http.get('http://profile.test/api/v1/profiles/me', () => HttpResponse.json(PROFILE_NO_PROFILE)),
    );

    const result = await loginAction({ email: 'user@example.com', password: 'ValidPass1!' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (result.value.stage !== 'authenticated') return;
    // 'access-token' is not a JWT, so email_verified cannot be decoded
    expect(result.value.emailVerified).toBeUndefined();
  });
});

describe('mfaChallengeAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns authenticated stage with roles on success', async () => {
    server.use(
      http.post('http://auth.test/api/v1/auth/mfa/challenge', () => HttpResponse.json(TOKENS)),
      http.get('http://auth.test/api/v1/auth/me', () =>
        HttpResponse.json({ userId: 'user-1', email: 'user@example.com', roles: ['tutor'], emailVerified: true }),
      ),
      http.get('http://profile.test/api/v1/profiles/me', () =>
        HttpResponse.json({ hasStudentProfile: false, hasTutorProfile: true }),
      ),
    );

    const result = await mfaChallengeAction({
      mfaChallengeToken: 'challenge',
      code: '123456',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stage).toBe('authenticated');
    if (result.value.stage !== 'authenticated') return;
    expect(result.value.roles).toContain('tutor');
    expect(result.value.hasTutorProfile).toBe(true);
  });

  it('returns err on 401 from MFA endpoint', async () => {
    server.use(
      http.post('http://auth.test/api/v1/auth/mfa/challenge', () =>
        HttpResponse.json({ title: 'Unauthorized' }, { status: 401 }),
      ),
    );

    const result = await mfaChallengeAction({ mfaChallengeToken: 'challenge', code: '123456' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unauthenticated');
  });

  it('returns validation error on malformed code without hitting the network', async () => {
    const result = await mfaChallengeAction({ mfaChallengeToken: 'tok', code: '12345' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
  });
});
