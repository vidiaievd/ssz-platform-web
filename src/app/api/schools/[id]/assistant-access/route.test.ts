// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/school/api/resolve-school-id', () => ({ resolveSchoolId: vi.fn() }));

const { GET, PUT } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import { AppError } from '@/lib/errors';

const SCHOOL_ID = '22222222-2222-4222-8222-222222222222';
const ACCESS = { mode: 'selected_groups', groupIds: ['g-1'], studentIds: [] };

const params = { params: Promise.resolve({ id: 'nordick' }) };

function put(body: unknown) {
  return new NextRequest('http://localhost/api/schools/nordick/assistant-access', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveSchoolId).mockResolvedValue(SCHOOL_ID);
});

describe('/api/schools/:id/assistant-access', () => {
  it('reads the choice by the school id the slug resolves to', async () => {
    vi.mocked(serverFetch).mockResolvedValue(ACCESS);

    const response = await GET(new NextRequest('http://localhost/x'), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ACCESS);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'organization',
        path: `/schools/${SCHOOL_ID}/assistant-access`,
      }),
    );
  });

  it('sends the choice whole and answers with what the service saved', async () => {
    vi.mocked(serverFetch).mockResolvedValue(ACCESS);

    const response = await PUT(put(ACCESS), params);

    expect(response.status).toBe(200);
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'PUT', body: ACCESS }),
    );
  });

  it('answers 404 for a school it cannot resolve, without asking upstream', async () => {
    vi.mocked(resolveSchoolId).mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost/x'), params);

    expect(response.status).toBe(404);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('tells a plan without the feature apart from a person without the right', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('forbidden', 'Upstream 403', {
        error: { code: 'FEATURE_NOT_ENTITLED', message: 'no key' },
      }),
    );
    const plan = await PUT(put(ACCESS), params);
    expect(plan.status).toBe(403);
    expect(await plan.json()).toEqual({ error: 'not_entitled' });

    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('forbidden', 'Upstream 403', { error: { code: 'FORBIDDEN_OPERATION' } }),
    );
    const person = await PUT(put(ACCESS), params);
    expect(person.status).toBe(403);
    expect(await person.json()).toEqual({ error: 'Forbidden' });
  });

  it('names a group or student that is no longer the school’s', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('validation', 'Upstream 422', { error: { code: 'INVALID_ASSISTANT_ACCESS' } }),
    );
    const gone = await PUT(put(ACCESS), params);
    expect(gone.status).toBe(422);
    expect(await gone.json()).toEqual({ error: 'invalid_access' });

    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('validation', 'Upstream 400'));
    const malformed = await PUT(put({ mode: 'everyone' }), params);
    expect(malformed.status).toBe(422);
    expect(await malformed.json()).toEqual({ error: 'validation' });
  });

  it('says 503 when the plan could not be confirmed upstream', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new AppError('upstream_unavailable', 'Upstream 503'));

    const response = await PUT(put(ACCESS), params);

    expect(response.status).toBe(503);
  });
});
