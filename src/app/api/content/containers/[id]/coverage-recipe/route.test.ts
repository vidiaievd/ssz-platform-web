// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { AppError } from '@/lib/errors';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET, PUT } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';

const RECIPE = { rules: [{ axis: 'input', values: ['audio'], min: 1 }] };
const RESOLVED = { recipe: RECIPE, inherited: RECIPE, overridden: false };
const params = { params: Promise.resolve({ id: 'course-1' }) };

function put(body: unknown) {
  return new NextRequest(
    new URL('http://localhost/api/content/containers/course-1/coverage-recipe'),
    {
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
  );
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/content/containers/[id]/coverage-recipe', () => {
  it('passes the resolved recipe through untouched', async () => {
    vi.mocked(serverFetch).mockResolvedValue(RESOLVED as never);

    const res = await GET(new NextRequest('http://localhost/x'), params);

    expect(await res.json()).toEqual(RESOLVED);
    expect(serverFetch).toHaveBeenCalledWith({
      service: 'content',
      path: '/containers/course-1/coverage-recipe',
    });
  });

  it('keeps a refusal a refusal', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new AppError('forbidden', 'no'));

    const res = await GET(new NextRequest('http://localhost/x'), params);

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/content/containers/[id]/coverage-recipe', () => {
  // Null is the request to inherit again, and must reach the service as a value.
  it('forwards null as null', async () => {
    vi.mocked(serverFetch).mockResolvedValue(RESOLVED as never);

    await PUT(put({ recipe: null }), params);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'PUT', body: { recipe: null } }),
    );
  });

  it('forwards a recipe as written', async () => {
    vi.mocked(serverFetch).mockResolvedValue(RESOLVED as never);

    await PUT(put({ recipe: RECIPE }), params);

    expect(serverFetch).toHaveBeenCalledWith(expect.objectContaining({ body: { recipe: RECIPE } }));
  });

  // A body that forgot the field must not hand the course back to the workspace.
  it('refuses a body without the field rather than reading it as null', async () => {
    const res = await PUT(put({}), params);

    expect(res.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON', async () => {
    const res = await PUT(put('{'), params);

    expect(res.status).toBe(400);
  });

  it('reports a rule the service refused as 422', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new AppError('validation', 'INVALID_COVERAGE_RECIPE'));

    const res = await PUT(put({ recipe: { rules: [{ axis: 'nope' }] } }), params);

    expect(res.status).toBe(422);
  });
});
