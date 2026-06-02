// @vitest-environment node

import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/msw/server';

import { AppError } from '../errors';
import { serverFetch } from './server-fetcher';

// serverFetch builds: base + UPSTREAM_API_PREFIX (/api/v1) + path
// → http://profile.test/api/v1/me for service='profile', path='/me'

describe('serverFetch', () => {
  it('returns parsed JSON on 200', async () => {
    server.use(
      http.get('http://profile.test/api/v1/me', () => HttpResponse.json({ id: '1', name: 'A' })),
    );
    const data = await serverFetch<{ id: string }>({ service: 'profile', path: '/me' });
    expect(data.id).toBe('1');
  });

  it('maps 401 to unauthenticated AppError (refresh token absent → no retry)', async () => {
    server.use(
      http.get('http://profile.test/api/v1/me', () => HttpResponse.json({}, { status: 401 })),
    );
    // No refresh token in shim → attemptRefresh returns false → unauthenticated thrown
    await expect(serverFetch({ service: 'profile', path: '/me' })).rejects.toMatchObject({
      code: 'unauthenticated',
    } satisfies Partial<AppError>);
  });

  it('maps 5xx to upstream_unavailable', async () => {
    server.use(
      http.get('http://profile.test/api/v1/me', () => HttpResponse.json({}, { status: 503 })),
    );
    await expect(serverFetch({ service: 'profile', path: '/me' })).rejects.toMatchObject({
      code: 'upstream_unavailable',
    });
  });
});
