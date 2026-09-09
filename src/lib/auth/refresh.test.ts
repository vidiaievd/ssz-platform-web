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
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` clears calls but keeps implementations, and one test below makes
    // the cookie store throw the way a Server Component render does.
    mockCookieSet.mockImplementation(() => undefined);
  });

  it('returns false and clears cookies when no refresh token', async () => {
    mockCookieGet.mockReturnValue(undefined);

    const result = await attemptRefresh();

    expect(result).toBe(false);
    expect(mockCookieDelete).toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it('does not rotate where the new pair could not be stored', async () => {
    /*
      A Server Component render: `cookies().set` throws there. The rotation must not
      happen at all — a token revoked on the server and lost on the way back is presented
      again on the next request, which auth-service reads as theft and answers by killing
      every session the user has (found live 06.09.2026).
    */
    withRefreshToken();
    mockCookieSet.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler');
    });
    let asked = false;
    server.use(
      http.post('http://auth.test/api/v1/auth/refresh', () => {
        asked = true;
        return HttpResponse.json(TOKENS);
      }),
    );

    const result = await attemptRefresh();

    expect(result).toBe(false);
    expect(asked).toBe(false);
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
    // The probe rewrites the refresh cookie with the value it already had; no new pair
    // was written, which is what a rejected refresh must leave behind.
    expect(mockCookieSet).not.toHaveBeenCalledWith('ssz_at', expect.anything(), expect.anything());
    expect(mockCookieSet).not.toHaveBeenCalledWith(
      'ssz_rt',
      'new-refresh',
      expect.anything(),
    );
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
