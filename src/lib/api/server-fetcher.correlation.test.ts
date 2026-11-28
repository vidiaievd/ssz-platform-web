// @vitest-environment node

import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';

// The caller's headers, as Next hands them to a route handler.
const incoming = vi.hoisted(() => ({ current: new Headers() as Headers | Error }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => {
    if (incoming.current instanceof Error) throw incoming.current;
    return incoming.current;
  },
}));

const { serverFetch } = await import('./server-fetcher');

const ID = '3f2c8a1e-5b7d-4c9a-8e21-0d6f4b3a9c10';

afterEach(() => {
  vi.restoreAllMocks();
});

/** What the upstream saw in X-Correlation-ID on one call. */
async function seenId(opts: { forwardClientHeaders?: boolean } = {}) {
  let seen: string | null = null;
  server.use(
    http.get('http://profile.test/api/v1/me', ({ request }) => {
      seen = request.headers.get('x-correlation-id');
      return HttpResponse.json({});
    }),
  );
  await serverFetch({ service: 'profile', path: '/me', ...opts });
  return seen;
}

describe('serverFetch — the correlation id (OQ-43)', () => {
  it("passes the page load's id on to the gateway", async () => {
    incoming.current = new Headers({ 'x-correlation-id': ID });
    expect(await seenId()).toBe(ID);
  });

  it('passes it on even when the call keeps the client headers back', async () => {
    incoming.current = new Headers({ 'x-correlation-id': ID });
    expect(await seenId({ forwardClientHeaders: false })).toBe(ID);
  });

  it('drops an id that is not one we accept', async () => {
    incoming.current = new Headers({ 'x-correlation-id': 'bad id\n' });
    expect(await seenId()).toBeNull();
  });

  it('still calls out of a request scope, without an id', async () => {
    incoming.current = new Error('headers() outside a request');
    expect(await seenId({ forwardClientHeaders: false })).toBeNull();
  });
});

describe('serverFetch — the request log line (OQ-43)', () => {
  it('logs a failed call as one JSON line, path without the query string', async () => {
    incoming.current = new Headers({ 'x-correlation-id': ID });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(
      http.get('http://organization.test/api/v1/schools/s1/users/lookup', () =>
        HttpResponse.json({ message: 'boom' }, { status: 503 }),
      ),
    );

    await expect(
      serverFetch({
        service: 'organization',
        path: '/schools/s1/users/lookup',
        query: { email: 'someone@example.com' },
      }),
    ).rejects.toThrow();

    expect(error).toHaveBeenCalledOnce();
    const line = JSON.parse(String(error.mock.calls[0]?.[0]));
    expect(line).toMatchObject({
      msg: 'bff.upstream',
      level: 'error',
      correlationId: ID,
      service: 'organization',
      method: 'GET',
      path: '/api/v1/schools/s1/users/lookup',
      status: 503,
      outcome: 'error',
    });
    expect(JSON.stringify(line)).not.toContain('someone@example.com');
  });

  it('logs an expected refusal at info, which a dev console does not print', async () => {
    incoming.current = new Headers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    server.use(
      http.get('http://profile.test/api/v1/me', () => HttpResponse.json({}, { status: 404 })),
    );

    await expect(
      serverFetch({ service: 'profile', path: '/me', expectedErrorStatuses: [404] }),
    ).rejects.toThrow();

    // Only the request log is asked about; the dev pretty printer may print its own line.
    const requestLog = [...warn.mock.calls, ...error.mock.calls].filter(([line]) =>
      String(line).includes('"msg":"bff.upstream"'),
    );
    expect(requestLog).toEqual([]);
  });
});
