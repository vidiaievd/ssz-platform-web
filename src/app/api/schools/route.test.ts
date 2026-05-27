// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { GET, POST } = await import('./route');
const { serverFetch } = await import('@/lib/api/server-fetcher');
const mockServerFetch = vi.mocked(serverFetch);

const SCHOOL = {
  id: 'school-1',
  name: 'Oslo Language School',
  description: 'Learn Norwegian',
  avatarUrl: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('GET /api/schools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 with school list from organization service', async () => {
    mockServerFetch.mockResolvedValue([SCHOOL]);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([SCHOOL]);
    expect(mockServerFetch).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'organization', path: '/schools' }),
    );
  });

  it('returns 401 when unauthenticated', async () => {
    const { AppError } = await import('@/lib/errors');
    mockServerFetch.mockRejectedValue(new AppError('unauthenticated', 'No token'));

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns 502 on upstream error', async () => {
    const { AppError } = await import('@/lib/errors');
    mockServerFetch.mockRejectedValue(new AppError('upstream_unavailable', 'Service down'));

    const res = await GET();

    expect(res.status).toBe(502);
  });
});

describe('POST /api/schools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 with the created school', async () => {
    mockServerFetch.mockResolvedValue(SCHOOL);

    const req = new NextRequest('http://localhost/api/schools', {
      method: 'POST',
      body: JSON.stringify({ name: 'Oslo Language School' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Oslo Language School');
  });

  it('forwards Idempotency-Key header to serverFetch', async () => {
    mockServerFetch.mockResolvedValue(SCHOOL);

    const req = new NextRequest('http://localhost/api/schools', {
      method: 'POST',
      body: JSON.stringify({ name: 'Oslo Language School' }),
      headers: { 'Content-Type': 'application/json', 'idempotency-key': 'key-abc-123' },
    });
    await POST(req);

    expect(mockServerFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'key-abc-123' }),
      }),
    );
  });

  it('does not include Idempotency-Key header when not provided', async () => {
    mockServerFetch.mockResolvedValue(SCHOOL);

    const req = new NextRequest('http://localhost/api/schools', {
      method: 'POST',
      body: JSON.stringify({ name: 'Oslo Language School' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(req);

    const call = mockServerFetch.mock.calls[0]?.[0];
    expect(call?.headers).toBeUndefined();
  });

  it('returns 409 when school name is already taken', async () => {
    const { AppError } = await import('@/lib/errors');
    mockServerFetch.mockRejectedValue(new AppError('conflict', 'Name taken'));

    const req = new NextRequest('http://localhost/api/schools', {
      method: 'POST',
      body: JSON.stringify({ name: 'Duplicate School' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
  });

  it('returns 422 on validation error from upstream', async () => {
    const { AppError } = await import('@/lib/errors');
    mockServerFetch.mockRejectedValue(new AppError('validation', 'Invalid data'));

    const req = new NextRequest('http://localhost/api/schools', {
      method: 'POST',
      body: JSON.stringify({ name: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it('returns 400 on malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/schools', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockServerFetch).not.toHaveBeenCalled();
  });
});
