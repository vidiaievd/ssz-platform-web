// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const attemptRefresh = vi.fn<() => Promise<boolean>>();
const readAccessToken = vi.fn<() => Promise<string | undefined>>();

vi.mock('@/lib/auth/refresh', () => ({ attemptRefresh: () => attemptRefresh() }));
vi.mock('@/lib/auth/cookies', () => ({ readAccessToken: () => readAccessToken() }));

const { GET } = await import('./route');

const call = (url: string) => GET(new NextRequest(new URL(url, 'http://app.test')));

describe('GET /api/auth/session/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attemptRefresh.mockResolvedValue(true);
    readAccessToken.mockResolvedValue('fresh-access-token');
  });

  it('returns the visitor to the page they were going to', async () => {
    const res = await call('/api/auth/session/refresh?next=/uk/school/nordick/content');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://app.test/uk/school/nordick/content');
  });

  it('sends them to login in their own locale when the session cannot be renewed', async () => {
    attemptRefresh.mockResolvedValue(false);

    const res = await call('/api/auth/session/refresh?next=/uk/school/nordick/content');

    expect(res.headers.get('location')).toBe(
      'http://app.test/uk/login?redirect=%2Fschool%2Fnordick%2Fcontent',
    );
  });

  it('does not loop when the refresh reports success but leaves no token', async () => {
    // Otherwise the redirect lands on a page with no access cookie, `proxy.ts` sends it
    // straight back here, and the two bounce forever.
    readAccessToken.mockResolvedValue(undefined);

    const res = await call('/api/auth/session/refresh?next=/uk/student');

    expect(res.headers.get('location')).toBe('http://app.test/uk/login?redirect=%2Fstudent');
  });

  it('refuses a `next` that leaves this origin or points back at itself', async () => {
    for (const next of [
      'https://evil.test/steal',
      '//evil.test/steal',
      '/\\evil.test/steal',
      '/api/auth/session/refresh?next=/uk/student',
    ]) {
      const res = await call(`/api/auth/session/refresh?next=${encodeURIComponent(next)}`);
      expect(res.headers.get('location')).toBe('http://app.test/en');
    }
  });
});
