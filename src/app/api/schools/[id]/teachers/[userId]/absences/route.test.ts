// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/scheduling/provider', () => ({
  getSchedulingProvider: vi.fn(),
}));

const { POST } = await import('./route');
const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
const mockGetProvider = vi.mocked(getSchedulingProvider);

const PARAMS = { params: Promise.resolve({ id: 'school-1', userId: 'teacher-1' }) };

describe('POST /api/schools/[id]/teachers/[userId]/absences (report absence)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 201 and creates substitute requests on success', async () => {
    const mockResult = {
      absenceId: 'absence-xyz',
      createdRequests: [
        {
          requestId: 'req-new',
          lessonId: 'l1',
          groupId: 'g1',
          groupName: 'English A1',
          originalTeacherId: 'teacher-1',
          coverWindow: { from: '2026-06-10', to: '2026-06-10' },
          urgency: 'upcoming',
          status: 'open',
          lang: 'en',
          day: 'Tue',
          start: '09:00',
          end: '10:30',
        },
      ],
    };
    mockGetProvider.mockReturnValue({
      reportAbsence: vi.fn().mockResolvedValue(mockResult),
    } as never);

    const req = new NextRequest(
      'http://localhost/api/schools/school-1/teachers/teacher-1/absences',
      {
        method: 'POST',
        body: JSON.stringify({
          kind: 'sick',
          scope: 'today',
          from: '2026-06-10',
          to: null,
          reason: 'Flu',
        }),
      },
    );
    const res = await POST(req, PARAMS);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.absenceId).toBe('absence-xyz');
    expect(body.createdRequests).toHaveLength(1);
    expect(body.createdRequests[0].status).toBe('open');
  });

  it('passes correct schoolId and teacherId to provider', async () => {
    const mockReportAbsence = vi.fn().mockResolvedValue({ absenceId: 'a1', createdRequests: [] });
    mockGetProvider.mockReturnValue({
      reportAbsence: mockReportAbsence,
    } as never);

    const req = new NextRequest(
      'http://localhost/api/schools/school-1/teachers/teacher-1/absences',
      {
        method: 'POST',
        body: JSON.stringify({ kind: 'leave', scope: 'window', from: '2026-06-10', to: '2026-06-14', reason: '' }),
      },
    );
    await POST(req, PARAMS);

    expect(mockReportAbsence).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: 'school-1', teacherId: 'teacher-1' }),
    );
  });

  it('returns 400 on malformed body', async () => {
    mockGetProvider.mockReturnValue({ reportAbsence: vi.fn() } as never);

    const req = new NextRequest(
      'http://localhost/api/schools/school-1/teachers/teacher-1/absences',
      { method: 'POST', body: '{bad}' },
    );
    const res = await POST(req, PARAMS);
    expect(res.status).toBe(400);
  });
});
