// @vitest-environment node

import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

// next-intl's middleware does not load under vitest (its ESM import of `next/server`). What
// proxy.ts relies on is that it passes the request's headers on — it does
// (`NextResponse.next({ request: { headers: new Headers(request.headers) } })`), so the stand-in
// does the same.
vi.mock('next-intl/middleware', () => ({
  default: () => (req: NextRequest) =>
    NextResponse.next({ request: { headers: new Headers(req.headers) } }),
}));

import { config, proxy } from './proxy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ID = '3f2c8a1e-5b7d-4c9a-8e21-0d6f4b3a9c10';

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, 'http://localhost:3000'), { headers });
}

/** The id the route handler will read — Next carries overridden request headers this way. */
function passedOn(response: Response) {
  return response.headers.get('x-middleware-request-x-correlation-id');
}

describe('proxy — the correlation id (OQ-43)', () => {
  it('gives a BFF call a fresh id, passed on and echoed', () => {
    const response = proxy(request('/api/schools/s1/members'));

    const id = response.headers.get('x-correlation-id');
    expect(id).toMatch(UUID_RE);
    expect(passedOn(response)).toBe(id);
  });

  it('keeps a well-formed id that came in', () => {
    const response = proxy(request('/api/me', { 'x-correlation-id': ID }));

    expect(response.headers.get('x-correlation-id')).toBe(ID);
    expect(passedOn(response)).toBe(ID);
  });

  it('replaces an id it would not log', () => {
    const response = proxy(request('/api/me', { 'x-correlation-id': 'not an id' }));

    expect(response.headers.get('x-correlation-id')).toMatch(UUID_RE);
  });

  it('stamps a page request too, through the locale middleware', () => {
    const response = proxy(request('/en/discover'));

    const id = response.headers.get('x-correlation-id');
    expect(id).toMatch(UUID_RE);
    expect(passedOn(response)).toBe(id);
  });

  it('leaves a BFF call alone otherwise: no locale redirect, no login redirect', () => {
    const response = proxy(request('/api/student/progress'));

    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('runs on /api but not on static files', () => {
    const [matcher] = config.matcher;
    const re = new RegExp(`^${matcher}$`);
    expect(re.test('/api/me')).toBe(true);
    expect(re.test('/_next/static/chunk.js')).toBe(false);
    expect(re.test('/robots.txt')).toBe(false);
  });
});
