// @vitest-environment node

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

const TOKENS = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessTokenExpiresAt: '',
  refreshTokenExpiresAt: '',
};

describe('loginAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns authenticated stage with roles on success', async () => {
    server.use(
      http.post('http://auth.test/api/v1/auth/login', () => HttpResponse.json(TOKENS)),
      http.get('http://auth.test/api/v1/auth/roles', () =>
        HttpResponse.json({ roles: ['student'] }),
      ),
    );

    const result = await loginAction({ email: 'user@example.com', password: 'ValidPass1!' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stage).toBe('authenticated');
    if (result.value.stage !== 'authenticated') return;
    expect(result.value.roles).toEqual(['student']);
  });

  it('writes auth cookies on successful login', async () => {
    server.use(
      http.post('http://auth.test/api/v1/auth/login', () => HttpResponse.json(TOKENS)),
      http.get('http://auth.test/api/v1/auth/roles', () => HttpResponse.json({ roles: [] })),
    );

    await loginAction({ email: 'user@example.com', password: 'ValidPass1!' });

    expect(mockCookieSet).toHaveBeenCalledWith('ssz_at', 'access-token', expect.any(Object));
    expect(mockCookieSet).toHaveBeenCalledWith('ssz_rt', 'refresh-token', expect.any(Object));
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
});

describe('mfaChallengeAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns authenticated stage with roles on success', async () => {
    server.use(
      http.post('http://auth.test/api/v1/auth/mfa/challenge', () => HttpResponse.json(TOKENS)),
      http.get('http://auth.test/api/v1/auth/roles', () =>
        HttpResponse.json({ roles: ['school'] }),
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
    expect(result.value.roles).toContain('school');
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
