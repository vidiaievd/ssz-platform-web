// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/school/api/get-my-schools', () => ({ getMySchools: vi.fn() }));
vi.mock('@/features/tutoring/api/get-tutor-workspace', () => ({ getTutorWorkspace: vi.fn() }));

const { resolveReviewScope } = await import('./review-scope');
import { serverFetch } from '@/lib/api/server-fetcher';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';
import { getTutorWorkspace } from '@/features/tutoring/api/get-tutor-workspace';

const WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';
const GROUP_ID = 'group-1';
const TUTOR = 'tutor-1';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(serverFetch).mockResolvedValue({ groupIds: [GROUP_ID], containerIds: [] } as never);
});

function signedIn(roles: string[]) {
  vi.mocked(getCurrentUser).mockResolvedValue({ userId: TUTOR, roles } as never);
}

describe('resolveReviewScope for a private tutor', () => {
  /**
   * A solo workspace is deliberately absent from "my schools" — nothing may call it a
   * school where the tutor can read it — so without the fallback their own queue is a 403.
   */
  it('resolves the tutor own workspace, as its OWNER', async () => {
    signedIn(['tutor']);
    vi.mocked(getMySchools).mockResolvedValue([]);
    vi.mocked(getTutorWorkspace).mockResolvedValue({
      schoolId: WORKSPACE_ID,
      groupId: GROUP_ID,
      name: 'Norsk med Dmytro',
      studentCount: 5,
    });

    const scope = await resolveReviewScope(WORKSPACE_ID);

    expect(scope).toEqual({
      schoolId: WORKSPACE_ID,
      teacherId: TUTOR,
      role: 'OWNER',
      groupIds: [GROUP_ID],
      containerIds: [],
    });
  });

  it('refuses another workspace than the caller own', async () => {
    signedIn(['tutor']);
    vi.mocked(getMySchools).mockResolvedValue([]);
    vi.mocked(getTutorWorkspace).mockResolvedValue({
      schoolId: WORKSPACE_ID,
      groupId: GROUP_ID,
      name: 'Norsk med Dmytro',
      studentCount: 5,
    });

    const response = await resolveReviewScope('33333333-3333-4333-8333-333333333333');

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(403);
  });

  /** Reading the workspace provisions one, so a stranger's 403 must not reach for it. */
  it('does not ask for a workspace when the caller is not a tutor', async () => {
    signedIn(['student']);
    vi.mocked(getMySchools).mockResolvedValue([]);

    const response = await resolveReviewScope(WORKSPACE_ID);

    expect(getTutorWorkspace).not.toHaveBeenCalled();
    expect((response as Response).status).toBe(403);
  });

  it('leaves a school member on the school path', async () => {
    signedIn(['school_admin']);
    vi.mocked(getMySchools).mockResolvedValue([
      { id: WORKSPACE_ID, slug: 'nordick', myRole: 'TEACHER' } as never,
    ]);

    const scope = await resolveReviewScope('nordick');

    expect(getTutorWorkspace).not.toHaveBeenCalled();
    expect(scope).toMatchObject({ schoolId: WORKSPACE_ID, role: 'TEACHER' });
  });
});
