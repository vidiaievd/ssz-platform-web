// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/lib/api/profile-directory', () => ({ fetchProfileSummaries: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/school/api/get-my-schools', () => ({ getMySchools: vi.fn() }));

const { GET } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';
import type { SchoolRole } from '@/features/school/types';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const TEACHER = 'teacher-1';
const ATTEMPT = 'att-1';
const SUBMITTED_AT = new Date(Date.now() - 30 * 3_600_000).toISOString();

const ENGINE_SUBMISSION = {
  attemptId: ATTEMPT,
  userId: 'student-1',
  status: 'pending',
  schoolId: SCHOOL_ID,
  containerId: 'course-1',
  groupId: 'group-1',
  exerciseId: 'ex-1',
  templateCode: 'short_answer',
  targetLanguage: 'nb',
  path: { course: 'Ny i Norge A2', module: 'Leksjon 7', exercise: 'Perfektum' },
  exerciseAvailable: true,
  submittedAt: SUBMITTED_AT,
  attemptNo: 1,
  previous: null,
  decision: null,
  lock: null,
  details: { totalItems: 3, routedItems: 1, passedItems: 2, items: [] },
  text: null,
  submittedAnswer: { items: [] },
};

/**
 * Routes upstream calls by path. The two scope reads are told apart by their `at`: one
 * asks about now, the other about the moment the work was handed in.
 */
type EngineSubmission = typeof ENGINE_SUBMISSION;

function upstream(
  overrides: {
    // `Partial` alone keeps the fixture's own literal types, and a case that hands back
    // `details: null` is exactly what this route exists to survive.
    submission?: (Partial<Omit<EngineSubmission, 'details'>> & { details?: unknown }) | 'missing';
    scopeNow?: string[];
    scopeThen?: string[];
    exerciseGone?: boolean;
  } = {},
) {
  const now = overrides.scopeNow ?? ['group-1'];
  const then = overrides.scopeThen ?? now;

  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string; query?: unknown }) => {
    if (opts.path === '/internal/review/scope') {
      const at = (opts.query as { at: string }).at;
      return { groupIds: at === SUBMITTED_AT ? then : now, containerIds: ['course-1'] };
    }
    if (opts.path === `/internal/attempts/${ATTEMPT}/review`) {
      if (overrides.submission === 'missing') throw new Error('404');
      return { ...ENGINE_SUBMISSION, ...(overrides.submission ?? {}) };
    }
    if (opts.path.startsWith('/schools') && opts.path.endsWith('/review-settings')) {
      return { respondWithinHours: 48 };
    }
    if (opts.path.endsWith('/review-settings')) {
      return { respondWithinHours: 24, overridden: true };
    }
    if (opts.path.endsWith('/groups')) return [{ id: 'group-1', name: 'A2 kveld' }];
    if (opts.path === '/internal/exercises/ex-1') {
      if (overrides.exerciseGone) throw new Error('404');
      return {
        exercise: {
          id: 'ex-1',
          templateCode: 'translate_to_target',
          content: {
            dir: 'to_target',
            format: 'single',
            langs: { target: 'Norsk', explain: 'Russisk' },
            items: [{ id: 's1', dir: 'to_target', source: 'Поэтому им нужно много еды.' }],
          },
          expectedAnswers: { items: { s1: { refs: ['Derfor trenger de mye mat.'] } } },
        },
      };
    }
    throw new Error(`unexpected upstream call: ${opts.path}`);
  });
}

function call(id = ATTEMPT, query = `?school=${SCHOOL_ID}`) {
  return GET(new NextRequest(`http://localhost/api/review/submissions/${id}${query}`), {
    params: Promise.resolve({ id }),
  });
}

function member(role: SchoolRole) {
  vi.mocked(getMySchools).mockResolvedValue([
    { id: SCHOOL_ID, name: 'Oslo skole', slug: 'oslo-skole', myRole: role },
  ] as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ roles: ['tutor'], userId: TEACHER });
  member('TEACHER');
  vi.mocked(fetchProfileSummaries).mockResolvedValue({
    'student-1': { userId: 'student-1', displayName: 'Anna Kowalska' },
  });
});

describe('GET /api/review/submissions/[id]', () => {
  it('composes the submission from four services into one answer', async () => {
    upstream();
    const body = await (await call()).json();

    expect(body.student.name).toBe('Anna Kowalska');
    expect(body.student.groupName).toBe('A2 kveld');
    expect(body.exercise.path).toEqual({ course: 'Ny i Norge A2', lesson: 'Leksjon 7' });
    // The course's own promise wins over the school's, and lateness follows from it.
    expect(body.slaHours).toBe(24);
    expect(body.overdue).toBe(true);
    expect(body.canDecide).toBe(true);
  });

  it('refuses a teacher of another group', async () => {
    upstream({ scopeNow: ['group-9'], scopeThen: ['group-9'] });
    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('not_a_reviewer');
  });

  it('lets a stand-in read what they covered, and names why they cannot decide it', async () => {
    // Held the group when the work came in; holds it no longer.
    upstream({ scopeNow: [], scopeThen: ['group-1'] });
    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.canDecide).toBe(false);
  });

  it('lets an administrator open a submission from a group they do not teach', async () => {
    member('ADMIN');
    upstream({ scopeNow: [], scopeThen: [] });
    const response = await call();

    expect(response.status).toBe(200);
    expect((await response.json()).canDecide).toBe(true);
  });

  it('answers 200 when the breakdown could not be built (criterion 20)', async () => {
    upstream({ submission: { details: null } });
    const response = await call();

    expect(response.status).toBe(200);
    expect((await response.json()).details).toBeNull();
  });

  it('opens a deleted exercise under its snapshotted path (criterion 21)', async () => {
    upstream({ submission: { exerciseAvailable: false } });
    const body = await (await call()).json();

    expect(body.exercise.available).toBe(false);
    expect(body.exercise.title).toBe('Perfektum');
    // Nothing to read the questions out of, and the analysis stands without them.
    expect(body.prompts).toEqual({});
  });

  it('joins in what each sentence asked, so the diff is read against a question', async () => {
    upstream();
    const body = await (await call()).json();

    expect(body.prompts.s1.prompt).toBe('Поэтому им нужно много еды.');
  });

  it('costs the questions, never the submission, when the exercise cannot be read', async () => {
    upstream({ exerciseGone: true });
    const response = await call();

    expect(response.status).toBe(200);
    expect((await response.json()).prompts).toEqual({});
  });

  it('does not reveal whether an attempt of another school exists', async () => {
    upstream({ submission: 'missing' });
    expect((await call()).status).toBe(404);
  });

  it('refuses a school the caller is not a member of, before asking the engine', async () => {
    vi.mocked(getMySchools).mockResolvedValue([]);
    upstream();
    expect((await call()).status).toBe(403);
    expect(serverFetch).not.toHaveBeenCalled();
  });
});
