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

const { attemptRefresh } = await import('./refresh');

const TOKENS = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  accessTokenExpiresAt: '',
  refreshTokenExpiresAt: '',
};

function withRefreshToken() {
  mockCookieGet.mockImplementation((name) =>
    name === 'ssz_rt' ? { value: 'valid-refresh-token' } : undefined,
  );
}

describe('attemptRefresh', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false and clears cookies when no refresh token', async () => {
    mockCookieGet.mockReturnValue(undefined);

    const result = await attemptRefresh();

    expect(result).toBe(false);
    expect(mockCookieDelete).toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it('returns true and rotates cookies on a successful refresh', async () => {
    withRefreshToken();
    server.use(
      http.post('http://auth.test/api/v1/auth/refresh', () => HttpResponse.json(TOKENS)),
    );

    const result = await attemptRefresh();

    expect(result).toBe(true);
    expect(mockCookieSet).toHaveBeenCalledWith('ssz_at', 'new-access', expect.any(Object));
    expect(mockCookieSet).toHaveBeenCalledWith('ssz_rt', 'new-refresh', expect.any(Object));
  });

  it('returns false and clears cookies when the Auth Service rejects the token', async () => {
    withRefreshToken();
    server.use(
      http.post('http://auth.test/api/v1/auth/refresh', () =>
        HttpResponse.json({ title: 'Unauthorized' }, { status: 401 }),
      ),
    );

    const result = await attemptRefresh();

    expect(result).toBe(false);
    expect(mockCookieDelete).toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it('fires only one HTTP request when called concurrently', async () => {
    withRefreshToken();
    let callCount = 0;
    server.use(
      http.post('http://auth.test/api/v1/auth/refresh', () => {
        callCount++;
        return HttpResponse.json(TOKENS);
      }),
    );

    const [r1, r2, r3] = await Promise.all([
      attemptRefresh(),
      attemptRefresh(),
      attemptRefresh(),
    ]);

    expect(callCount).toBe(1);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(r3).toBe(true);
  });
});
