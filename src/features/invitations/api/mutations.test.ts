// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock next/cache before any module that calls revalidateTag ────────────────
const revalidateTagMock = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag: revalidateTagMock }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(() => ({ value: 'test-token' })), set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));

// ── Provide the mock provider directly to avoid require() in ESM context ─────
import { mockProvider, resetMockStore } from '@/lib/invitations/mock';
vi.mock('@/lib/invitations/provider', () => ({
  getInvitationsProvider: () => mockProvider,
}));

const { resendInvitation, revokeInvitation, resendTutoringInvitation, revokeTutoringInvitation } =
  await import('./mutations');
const { getInvitations, getPendingCount, getTutoringInvitations } = await import('./queries');

const SCHOOL_ID = 'school-test-1';

beforeEach(() => {
  resetMockStore();
  revalidateTagMock.mockClear();
});

// ── getInvitations (query) ────────────────────────────────────────────────────

describe('getInvitations', () => {
  it('returns all 7 fixture invitations with no filter', async () => {
    const items = await getInvitations(SCHOOL_ID);
    expect(items).toHaveLength(7);
  });

  it('filters by status=pending', async () => {
    const items = await getInvitations(SCHOOL_ID, { status: 'pending' });
    expect(items.every((i) => i.status === 'pending')).toBe(true);
    // pending: inv-teacher-pending, inv-teacher-soon, inv-content-admin-pending, inv-scheduler-pending
    expect(items).toHaveLength(4);
  });

  it('filters by audience=teachers returns only TEACHER role', async () => {
    const items = await getInvitations(SCHOOL_ID, { audience: 'teachers' });
    expect(items.every((i) => i.role === 'TEACHER')).toBe(true);
    expect(items).toHaveLength(2);
  });

  it('filters by audience=students returns only STUDENT role', async () => {
    const items = await getInvitations(SCHOOL_ID, { audience: 'students' });
    expect(items.every((i) => i.role === 'STUDENT')).toBe(true);
    expect(items).toHaveLength(2);
  });

  it('filters by audience=staff returns ADMIN/CONTENT_ADMIN/SCHEDULER roles', async () => {
    const items = await getInvitations(SCHOOL_ID, { audience: 'staff' });
    const staffRoles = ['ADMIN', 'CONTENT_ADMIN', 'SCHEDULER'];
    expect(items.every((i) => staffRoles.includes(i.role))).toBe(true);
    expect(items).toHaveLength(3);
  });

  it('filters by search (email prefix)', async () => {
    const items = await getInvitations(SCHOOL_ID, { search: 'alice' });
    expect(items).toHaveLength(1);
    expect(items[0]!.email).toBe('alice@example.com');
  });
});

// ── getPendingCount ───────────────────────────────────────────────────────────

describe('getPendingCount', () => {
  it('returns total pending count for all audiences', async () => {
    const count = await getPendingCount(SCHOOL_ID);
    expect(count).toBe(4);
  });

  it('returns pending teachers count', async () => {
    const count = await getPendingCount(SCHOOL_ID, 'teachers');
    expect(count).toBe(2);
  });
});

// ── resendInvitation ──────────────────────────────────────────────────────────

describe('resendInvitation', () => {
  it('returns ok=true and extends expiry for pending invitation', async () => {
    const result = await resendInvitation(SCHOOL_ID, 'inv-teacher-pending');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resendCount).toBe(1);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(result.lastSentAt).toBeDefined();
  });

  it('calls revalidateTag with school cache tag on success', async () => {
    await resendInvitation(SCHOOL_ID, 'inv-teacher-pending');
    expect(revalidateTagMock).toHaveBeenCalledWith(`invitations:${SCHOOL_ID}`, {});
  });

  it('returns already-accepted for accepted invitation (→ 409 equivalent)', async () => {
    const result = await resendInvitation(SCHOOL_ID, 'inv-student-accepted');
    expect(result).toEqual({ ok: false, reason: 'already-accepted' });
  });

  it('does not call revalidateTag on already-accepted error', async () => {
    await resendInvitation(SCHOOL_ID, 'inv-student-accepted');
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('returns error for revoked invitation (provider throws unknown AppError)', async () => {
    const result = await resendInvitation(SCHOOL_ID, 'inv-admin-revoked');
    expect(result).toEqual({ ok: false, reason: 'error' });
  });

  it('returns gone for non-existent invitationId (→ 410 equivalent)', async () => {
    const result = await resendInvitation(SCHOOL_ID, 'inv-does-not-exist');
    expect(result).toEqual({ ok: false, reason: 'gone' });
  });

  it('resending expired invitation extends it back to pending', async () => {
    const result = await resendInvitation(SCHOOL_ID, 'inv-student-expired');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

// ── revokeInvitation ──────────────────────────────────────────────────────────

describe('revokeInvitation', () => {
  it('returns ok=true for pending invitation', async () => {
    const result = await revokeInvitation(SCHOOL_ID, 'inv-teacher-pending');
    expect(result).toEqual({ ok: true });
  });

  it('calls revalidateTag on success', async () => {
    await revokeInvitation(SCHOOL_ID, 'inv-teacher-pending');
    expect(revalidateTagMock).toHaveBeenCalledWith(`invitations:${SCHOOL_ID}`, {});
  });

  it('returns already-accepted for accepted invitation (→ 409 equivalent)', async () => {
    const result = await revokeInvitation(SCHOOL_ID, 'inv-student-accepted');
    expect(result).toEqual({ ok: false, reason: 'already-accepted' });
  });

  it('does not call revalidateTag on already-accepted error', async () => {
    await revokeInvitation(SCHOOL_ID, 'inv-student-accepted');
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('returns gone for non-existent invitationId (→ 410 equivalent)', async () => {
    const result = await revokeInvitation(SCHOOL_ID, 'inv-does-not-exist');
    expect(result).toEqual({ ok: false, reason: 'gone' });
  });
});

// ── Tutoring mutations ────────────────────────────────────────────────────────

describe('getTutoringInvitations', () => {
  it('returns 2 tutoring fixture invitations', async () => {
    const items = await getTutoringInvitations();
    expect(items).toHaveLength(2);
  });
});

describe('resendTutoringInvitation', () => {
  it('returns ok=true and invalidates tutoring cache tag', async () => {
    const result = await resendTutoringInvitation('inv-tutor-pending');
    expect(result.ok).toBe(true);
    expect(revalidateTagMock).toHaveBeenCalledWith('invitations:tutoring', {});
  });

  it('returns already-accepted for accepted tutoring invitation', async () => {
    const result = await resendTutoringInvitation('inv-tutor-accepted');
    expect(result).toEqual({ ok: false, reason: 'already-accepted' });
  });
});

describe('revokeTutoringInvitation', () => {
  it('returns ok=true and invalidates tutoring cache tag', async () => {
    const result = await revokeTutoringInvitation('inv-tutor-pending');
    expect(result).toEqual({ ok: true });
    expect(revalidateTagMock).toHaveBeenCalledWith('invitations:tutoring', {});
  });

  it('returns already-accepted for accepted tutoring invitation', async () => {
    const result = await revokeTutoringInvitation('inv-tutor-accepted');
    expect(result).toEqual({ ok: false, reason: 'already-accepted' });
  });
});
