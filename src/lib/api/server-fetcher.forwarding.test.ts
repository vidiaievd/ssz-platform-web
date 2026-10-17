// @vitest-environment node

import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';

// The caller's headers, as Next hands them to a route handler.
const incoming = vi.hoisted(() => ({ current: new Headers() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => incoming.current,
}));

const { serverFetch, nearestForwardedFor } = await import('./server-fetcher');

/** What the upstream saw in X-Forwarded-For on one call. */
async function forwardedFor(opts: { forwardClientHeaders?: boolean } = {}) {
  let seen: string | null = null;
  server.use(
    http.get('http://profile.test/api/v1/me', ({ request }) => {
      seen = request.headers.get('x-forwarded-for');
      return HttpResponse.json({});
    }),
  );
  await serverFetch({ service: 'profile', path: '/me', ...opts });
  return seen;
}

describe('serverFetch — the client address for the gateway (plan 76, Q10)', () => {
  it('forwards the hop nearest to the BFF, not the whole chain', async () => {
    incoming.current = new Headers({ 'x-forwarded-for': '203.0.113.9, 198.51.100.4' });
    expect(await forwardedFor()).toBe('198.51.100.4');
  });

  it('forwards the address Next took from the socket', async () => {
    incoming.current = new Headers({ 'x-forwarded-for': '::1' });
    expect(await forwardedFor()).toBe('::1');
  });

  it('sends nothing when there is no address to pass on', async () => {
    incoming.current = new Headers();
    expect(await forwardedFor()).toBeNull();
  });

  it('sends nothing when the call opts out of client headers', async () => {
    incoming.current = new Headers({ 'x-forwarded-for': '203.0.113.9' });
    expect(await forwardedFor({ forwardClientHeaders: false })).toBeNull();
  });
});

describe('nearestForwardedFor', () => {
  it.each([
    [null, null],
    ['', null],
    [' , ', null],
    ['203.0.113.9', '203.0.113.9'],
    ['203.0.113.9 , 198.51.100.4 ', '198.51.100.4'],
  ])('reads %j as %j', (header, expected) => {
    expect(nearestForwardedFor(header)).toBe(expected);
  });
});
