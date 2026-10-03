// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { AppError } from '@/lib/errors';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET, PUT } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';

const RECIPE = { rules: [{ axis: 'input', values: ['audio'], min: 1 }] };
const SAVED = { schoolId: 'school-1', recipe: RECIPE, updatedAt: '2026-10-03T07:00:00.000Z' };
const params = { params: Promise.resolve({ id: 'school-1' }) };

function put(body: unknown) {
  return new NextRequest(
    new URL('http://localhost/api/content/coverage-recipes/workspaces/school-1'),
    {
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  );
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/content/coverage-recipes/workspaces/[id]', () => {
  it('passes the recipe through untouched', async () => {
    vi.mocked(serverFetch).mockResolvedValue(SAVED as never);

    const res = await GET(new NextRequest('http://localhost/x'), params);

    expect(await res.json()).toEqual(SAVED);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/coverage-recipes/workspaces/school-1',
    });
  });

  // Never set is its own state, and must not turn into an empty recipe on the way.
  it('keeps a recipe that was never set as null', async () => {
    vi.mocked(serverFetch).mockResolvedValue({ ...SAVED, recipe: null, updatedAt: null } as never);

    const res = await GET(new NextRequest('http://localhost/x'), params);

    expect((await res.json()).recipe).toBeNull();
  });

  it('keeps a refusal a refusal', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new AppError('forbidden', 'no'));

    const res = await GET(new NextRequest('http://localhost/x'), params);

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/content/coverage-recipes/workspaces/[id]', () => {
  it('forwards a recipe as written', async () => {
    vi.mocked(serverFetch).mockResolvedValue(SAVED as never);

    await PUT(put({ recipe: RECIPE }), params);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'PUT', body: { recipe: RECIPE } }),
    );
  });

  it('forwards a recipe of no rules', async () => {
    vi.mocked(serverFetch).mockResolvedValue(SAVED as never);

    await PUT(put({ recipe: { rules: [] } }), params);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ body: { recipe: { rules: [] } } }),
    );
  });

  it.each([{}, { recipe: null }])('refuses %j without asking the service', async (body) => {
    const res = await PUT(put(body), params);

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON', async () => {
    const res = await PUT(put('{'), params);

    expect(res.status).toBe(400);
  });

  it('reports a recipe the service refused as 422', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new AppError('validation', 'INVALID_COVERAGE_RECIPE'));

    const res = await PUT(put({ recipe: { rules: [{ axis: 'nope' }] } }), params);

    expect(res.status).toBe(422);
  });

  it('reports a role the service refused as 403', async () => {
    vi.mocked(serverFetch).mockRejectedValue(
      new AppError('forbidden', 'insufficient_workspace_role'),
    );

    const res = await PUT(put({ recipe: RECIPE }), params);

    expect(res.status).toBe(403);
  });
});
