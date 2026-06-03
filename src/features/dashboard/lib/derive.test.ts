import { describe, expect, it } from 'vitest';

import { computeOnboarding, deriveDataState, deriveSchoolType, deriveViewerRole } from './derive';

// ─── deriveSchoolType ─────────────────────────────────────────────────────────

describe('deriveSchoolType', () => {
  it('returns hybrid for HYBRID', () => {
    expect(deriveSchoolType({ type: 'HYBRID' })).toBe('hybrid');
  });

  it('returns online for ONLINE', () => {
    expect(deriveSchoolType({ type: 'ONLINE' })).toBe('online');
  });

  it('defaults to online when type is absent', () => {
    expect(deriveSchoolType({})).toBe('online');
    expect(deriveSchoolType({ type: null })).toBe('online');
  });
});

// ─── deriveDataState ──────────────────────────────────────────────────────────

describe('deriveDataState', () => {
  it('returns empty for a brand-new school with 1 member and 0 courses', () => {
    expect(deriveDataState({ membersCount: 1, coursesCount: 0, hasActivity: false })).toBe('empty');
  });

  it('returns empty for 0 members and 0 courses', () => {
    expect(deriveDataState({ membersCount: 0, coursesCount: 0, hasActivity: false })).toBe('empty');
  });

  it('returns partial when there are courses but no activity', () => {
    expect(deriveDataState({ membersCount: 3, coursesCount: 2, hasActivity: false })).toBe('partial');
  });

  it('returns partial when there are multiple members and courses but no activity', () => {
    expect(deriveDataState({ membersCount: 5, coursesCount: 1, hasActivity: false })).toBe('partial');
  });

  it('returns full when courses > 0, members > 1, and has activity', () => {
    expect(deriveDataState({ membersCount: 3, coursesCount: 2, hasActivity: true })).toBe('full');
  });

  it('returns partial when only 1 member even with courses and activity', () => {
    expect(deriveDataState({ membersCount: 1, coursesCount: 2, hasActivity: true })).toBe('partial');
  });
});

// ─── deriveViewerRole ─────────────────────────────────────────────────────────

describe('deriveViewerRole', () => {
  const OWNER_ID = 'owner-uuid';
  const ADMIN_ID = 'admin-uuid';
  const TEACHER_ID = 'teacher-uuid';
  const EDITOR_ID = 'editor-uuid';
  const STUDENT_ID = 'student-uuid';
  const UNKNOWN_ID = 'unknown-uuid';

  const school = {
    ownerId: OWNER_ID,
    members: [
      { userId: ADMIN_ID, role: 'ADMIN' as const },
      { userId: TEACHER_ID, role: 'TEACHER' as const },
      { userId: EDITOR_ID, role: 'CONTENT_ADMIN' as const },
      { userId: STUDENT_ID, role: 'STUDENT' as const },
    ],
  };

  it('resolves owner by ownerId', () => {
    expect(deriveViewerRole(school, OWNER_ID)).toBe('owner');
  });

  it('resolves admin from members', () => {
    expect(deriveViewerRole(school, ADMIN_ID)).toBe('admin');
  });

  it('resolves teacher from members', () => {
    expect(deriveViewerRole(school, TEACHER_ID)).toBe('teacher');
  });

  it('resolves editor from CONTENT_ADMIN role', () => {
    expect(deriveViewerRole(school, EDITOR_ID)).toBe('editor');
  });

  it('resolves student as teacher (min access)', () => {
    expect(deriveViewerRole(school, STUDENT_ID)).toBe('teacher');
  });

  it('falls back to teacher for unknown userId', () => {
    expect(deriveViewerRole(school, UNKNOWN_ID)).toBe('teacher');
  });

  it('falls back to teacher when members array is absent', () => {
    expect(deriveViewerRole({ ownerId: 'other' }, UNKNOWN_ID)).toBe('teacher');
  });
});

// ─── computeOnboarding ───────────────────────────────────────────────────────

describe('computeOnboarding', () => {
  const baseInput = {
    school: { avatarUrl: null, description: null },
    membersCount: 1,
    coursesCount: 0,
    hasPublishedLesson: false,
    hasPendingInvitation: false,
  };

  it('returns 0 completed for a brand-new school', () => {
    const result = computeOnboarding(baseInput);
    expect(result.completed).toBe(0);
    expect(result.total).toBe(5);
    expect(result.minutesLeft).toBe(25); // 5+2+5+3+10
  });

  it('marks create-course done when coursesCount > 0', () => {
    const result = computeOnboarding({ ...baseInput, coursesCount: 1 });
    const item = result.items.find((i) => i.key === 'create-course');
    expect(item?.done).toBe(true);
    expect(result.completed).toBe(1);
  });

  it('marks invite-teacher done when membersCount > 1', () => {
    const result = computeOnboarding({ ...baseInput, membersCount: 2 });
    const item = result.items.find((i) => i.key === 'invite-teacher');
    expect(item?.done).toBe(true);
  });

  it('marks invite-teacher done when there is a pending invitation', () => {
    const result = computeOnboarding({ ...baseInput, hasPendingInvitation: true });
    const item = result.items.find((i) => i.key === 'invite-teacher');
    expect(item?.done).toBe(true);
  });

  it('marks fill-branding done when both avatarUrl and description present', () => {
    const result = computeOnboarding({
      ...baseInput,
      school: { avatarUrl: 'https://x.com/logo.png', description: 'A school' },
    });
    const item = result.items.find((i) => i.key === 'fill-branding');
    expect(item?.done).toBe(true);
  });

  it('does not mark fill-branding done when only one field present', () => {
    const result = computeOnboarding({
      ...baseInput,
      school: { avatarUrl: null, description: 'A school' },
    });
    const item = result.items.find((i) => i.key === 'fill-branding');
    expect(item?.done).toBe(false);
  });

  it('marks publish-lesson done when hasPublishedLesson is true', () => {
    const result = computeOnboarding({ ...baseInput, hasPublishedLesson: true });
    const item = result.items.find((i) => i.key === 'publish-lesson');
    expect(item?.done).toBe(true);
  });

  it('computes minutesLeft for remaining items only', () => {
    // Only create-course done: remaining = invite-teacher(2) + fill-branding(5) + invite-students(3) + publish-lesson(10) = 20
    const result = computeOnboarding({ ...baseInput, coursesCount: 1 });
    expect(result.minutesLeft).toBe(20);
  });

  it('returns 0 minutesLeft when all items are done', () => {
    const result = computeOnboarding({
      school: { avatarUrl: 'https://x.com/logo.png', description: 'A school' },
      membersCount: 5,
      coursesCount: 2,
      hasPublishedLesson: true,
      hasPendingInvitation: false,
    });
    expect(result.minutesLeft).toBe(0);
    expect(result.completed).toBe(5);
  });
});
