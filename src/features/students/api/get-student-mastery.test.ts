// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/mastery/api/get-mastery-profile', () => ({ getMasteryProfile: vi.fn() }));

const { getStudentMastery } = await import('./get-student-mastery');
import { getMasteryProfile } from '@/features/mastery/api/get-mastery-profile';
import { serverFetch } from '@/lib/api/server-fetcher';

type Call = { service: string; path: string; query?: Record<string, unknown> };

/** Answer each upstream by the path it was asked on, the way the gateway would. */
function upstream(answers: Record<string, unknown>) {
  vi.mocked(serverFetch).mockImplementation(async (options: unknown) => {
    const { path } = options as Call;
    const key = Object.keys(answers).find((candidate) => path.includes(candidate));
    if (key === undefined) throw new Error(`unexpected path ${path}`);
    const answer = answers[key];
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

const calls = (): Call[] => vi.mocked(serverFetch).mock.calls.map(([options]) => options as Call);

beforeEach(() => {
  vi.mocked(serverFetch).mockReset();
  vi.mocked(getMasteryProfile).mockReset();
  vi.mocked(getMasteryProfile).mockResolvedValue(null);
});

describe('getStudentMastery', () => {
  // The position endpoint answers "there is no scale" with an empty body, which arrives
  // as `undefined`. A screen guarding only against `null` then reads `own` off nothing —
  // which is exactly how this went down live.
  it('turns an empty body into null rather than undefined', async () => {
    upstream({
      '/groups/': { courseId: 'c1' },
      grid: { cells: [] },
      position: undefined,
      'work-context': undefined,
    });

    const result = await getStudentMastery({ schoolId: 's', studentId: 'u1', groupIds: ['g1'] });

    expect(result.position).toBeNull();
    expect(result.workContext).toBeNull();
  });

  it('reads the numbers against the first group that teaches a course', async () => {
    vi.mocked(serverFetch).mockImplementation(async (options: unknown) => {
      const { path } = options as Call;
      if (path.endsWith('/groups/no-course')) return { courseId: null };
      if (path.endsWith('/groups/teaches')) return { courseId: 'c9' };
      return {};
    });

    const result = await getStudentMastery({
      schoolId: 's',
      studentId: 'u1',
      groupIds: ['no-course', 'teaches'],
    });

    expect(result).toMatchObject({ groupId: 'teaches', courseId: 'c9' });
    expect(
      calls().some((call) => call.path.includes('/position') && call.query?.groupId === 'teaches'),
    ).toBe(true);
    expect(calls().some((call) => call.query?.courseId === 'c9')).toBe(true);
  });

  // Without a course the grid is unscoped rather than absent: `noContent` cannot be said,
  // but what the learner has attempted is still true.
  it('still asks for a grid when no group of theirs teaches anything', async () => {
    upstream({
      '/groups/': { courseId: null },
      grid: { cells: [] },
      position: null,
      'work-context': null,
    });

    const result = await getStudentMastery({ schoolId: 's', studentId: 'u1', groupIds: ['g1'] });

    expect(result.courseId).toBeNull();
    expect(result.groupId).toBe('g1');
    expect(calls().some((call) => call.path.includes('/grid'))).toBe(true);
  });

  it('asks for no position at all for a learner in no group', async () => {
    upstream({ grid: { cells: [] }, 'work-context': null });

    const result = await getStudentMastery({ schoolId: 's', studentId: 'u1', groupIds: [] });

    expect(result.position).toBeNull();
    expect(calls().some((call) => call.path.includes('/position'))).toBe(false);
  });

  // One upstream falling over must not empty the other three: they answer different
  // questions, and the screen says which one is missing.
  it('keeps the answers it did get when one upstream fails', async () => {
    upstream({
      '/groups/': { courseId: 'c1' },
      grid: new Error('analytics down'),
      position: { own: 40 },
      'work-context': { buckets: [] },
    });

    const result = await getStudentMastery({ schoolId: 's', studentId: 'u1', groupIds: ['g1'] });

    expect(result.grid).toBeNull();
    expect(result.position).toMatchObject({ own: 40 });
    expect(result.workContext).toMatchObject({ buckets: [] });
  });
});
