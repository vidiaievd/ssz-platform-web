// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { PUT } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const params = { params: Promise.resolve({ id: 'course-1' }) };

function put(body: unknown) {
  return new NextRequest('http://localhost/api/content/containers/course-1/review-policy', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PUT /api/content/containers/:id/review-policy', () => {
  it('keeps null as the request to inherit and drops stray fields', async () => {
    vi.mocked(serverFetch).mockResolvedValue({});

    await PUT(put({ teacherReviewTemplates: ['writing_task'], mode: 'ai_then_teacher' }), params);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'content',
        path: '/containers/course-1/review-policy',
        method: 'PUT',
        body: { autoAcceptAfterHours: null, teacherReviewTemplates: ['writing_task'] },
      }),
    );
  });

  it('passes an unknown template refusal through as 422', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new AppError('validation', 'Upstream 422'));

    const response = await PUT(
      put({ autoAcceptAfterHours: 48, teacherReviewTemplates: ['x'] }),
      params,
    );

    expect(response.status).toBe(422);
  });
});
