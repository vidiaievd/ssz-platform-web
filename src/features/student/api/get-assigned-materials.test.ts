// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { getAssignedMaterials } = await import('./get-assigned-materials');
import { serverFetch } from '@/lib/api/server-fetcher';

const ASSIGNMENTS_RESPONSE = [
  {
    id: 'assignment-1',
    schoolId: 'school-1',
    contentRef: { type: 'LESSON', id: 'lesson-1' },
    status: 'ACTIVE',
    dueAt: '2026-07-01T00:00:00Z',
    notes: null,
  },
  {
    id: 'assignment-2',
    schoolId: 'school-1',
    contentRef: { type: 'EXERCISE', id: 'exercise-1' },
    status: 'OVERDUE',
    dueAt: '2026-06-01T00:00:00Z',
    notes: 'Focus on irregular verbs',
  },
  {
    id: 'assignment-3',
    schoolId: 'school-2',
    contentRef: { type: 'LESSON', id: 'lesson-2' },
    status: 'ACTIVE',
    dueAt: '2026-07-05T00:00:00Z',
    notes: null,
  },
  {
    id: 'assignment-4',
    schoolId: 'school-1',
    contentRef: { type: 'LESSON', id: 'lesson-3' },
    status: 'CANCELLED',
    dueAt: '2026-06-10T00:00:00Z',
    notes: null,
  },
];

describe('getAssignedMaterials', () => {
  it('hydrates active/overdue assignments scoped to the given school, dropping cancelled ones', async () => {
    vi.mocked(serverFetch).mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/assignments/mine') return ASSIGNMENTS_RESPONSE;
      if (path === '/lessons/lesson-1') return { title: 'Chapter 3 — Past Tense' };
      if (path.startsWith('/exercises/')) throw new Error('no exercise page yet');
      throw new Error(`unexpected path: ${path}`);
    });

    const result = await getAssignedMaterials('school-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      assignmentId: 'assignment-1',
      title: 'Chapter 3 — Past Tense',
      status: 'active',
      href: '/student/enrolled/lessons/lesson-1',
    });
  });

  it('returns an empty list when the upstream call fails', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new Error('upstream down'));

    const result = await getAssignedMaterials('school-1');

    expect(result).toEqual([]);
  });
});
