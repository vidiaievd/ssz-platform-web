// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/school/api/get-my-schools', () => ({ getMySchools: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';
import { AppError } from '@/lib/errors/app-error';
import type { ReviewRemindResult } from '@/features/review/types/oversight';

const SCHOOL_ID = '33333333-3333-4333-8333-333333333333';

function upstream(overrides: { reminder?: () => unknown; pending?: number } = {}) {
  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
    if (opts.path === '/internal/review/scope') return { groupIds: ['g1'], containerIds: [] };
    if (opts.path === '/internal/attempts/review/queue/count') {
      return { pending: overrides.pending ?? 12, oldestSubmittedAt: null };
    }
    if (opts.path.endsWith('/review-reminders')) {
      return overrides.reminder ? overrides.reminder() : { sent: true };
    }
    throw new Error(`unexpected upstream call: ${opts.path}`);
  });
}

function request(body: unknown = { teacherId: 'teacher-1' }): NextRequest {
  return new NextRequest(`http://localhost/api/review/remind?school=${SCHOOL_ID}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ userId: 'admin-1' } as never);
  vi.mocked(getMySchools).mockResolvedValue([
    { id: SCHOOL_ID, name: 'Skolen', myRole: 'ADMIN' },
  ] as never);
  upstream();
});

describe('POST /api/review/remind', () => {
  it('counts what waits on that reviewer and sends one message with the number', async () => {
    const response = await POST(request());
    const body = (await response.json()) as ReviewRemindResult;

    expect(body).toEqual({ sent: true, pending: 12 });
    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        path: `/schools/${SCHOOL_ID}/review-reminders`,
        body: { teacherId: 'teacher-1', pending: 12 },
      }),
    );
  });

  it('answers a second reminder in the same day with when the next one may go', async () => {
    const nextAllowedAt = new Date(Date.now() + 5 * 3_600_000).toISOString();
    upstream({
      reminder: () => {
        throw new AppError('rate_limited', 'too soon', { error: 'too-soon', nextAllowedAt });
      },
    });

    const response = await POST(request());
    const body = (await response.json()) as ReviewRemindResult;

    // Not an error: being told to wait until tomorrow is an answer the row can show.
    expect(response.status).toBe(200);
    expect(body.sent).toBe(false);
    expect(body.retryAfterHours).toBe(5);
  });

  it('refuses a teacher of the school', async () => {
    vi.mocked(getMySchools).mockResolvedValue([
      { id: SCHOOL_ID, name: 'Skolen', myRole: 'TEACHER' },
    ] as never);

    expect((await POST(request())).status).toBe(403);
  });

  it('refuses a request that names nobody', async () => {
    expect((await POST(request({}))).status).toBe(400);
  });
});
