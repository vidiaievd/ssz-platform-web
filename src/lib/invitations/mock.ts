import { AppError } from '@/lib/errors/app-error';
import type { Invitation, InvitePreview } from '@/features/invitations/types';
import type { InvitationsProvider, ResendResult } from './provider';
import {
  FIXTURE_INVITATIONS,
  FIXTURE_TUTORING_INVITATIONS,
  FIXTURE_PREVIEW_BASE_DATE,
} from './fixtures';

// ── In-memory state (resets per process) ─────────────────────────────────────

const RESEND_EXTEND_DAYS = 14;

function cloneFixtures(src: Invitation[]): Invitation[] {
  return src.map((inv) => ({ ...inv }));
}

let schoolStore: Invitation[] = cloneFixtures(FIXTURE_INVITATIONS);
let tutoringStore: Invitation[] = cloneFixtures(FIXTURE_TUTORING_INVITATIONS);

// ── Helpers ───────────────────────────────────────────────────────────────────

function find(store: Invitation[], invitationId: string): Invitation {
  const inv = store.find((i) => i.invitationId === invitationId);
  if (!inv) throw new AppError('not_found', `Invitation ${invitationId} not found`);
  return inv;
}

function guardNotAccepted(inv: Invitation): void {
  if (inv.status === 'accepted') {
    throw new AppError('conflict', 'Invitation already accepted');
  }
}

function doResend(inv: Invitation): ResendResult {
  guardNotAccepted(inv);
  if (inv.status === 'revoked') {
    throw new AppError('unknown', 'Invitation is revoked');
  }
  const now = new Date();
  const newExpiry = new Date(now.getTime() + RESEND_EXTEND_DAYS * 24 * 60 * 60 * 1000);
  inv.expiresAt = newExpiry.toISOString();
  inv.lastSentAt = now.toISOString();
  inv.resendCount += 1;
  inv.status = 'pending';
  return {
    expiresAt: inv.expiresAt,
    resendCount: inv.resendCount,
    lastSentAt: inv.lastSentAt,
  };
}

function doRevoke(inv: Invitation): void {
  guardNotAccepted(inv);
  inv.status = 'revoked';
}

// ── Mock preview ──────────────────────────────────────────────────────────────

function mockPreview(token: string): InvitePreview {
  const now = FIXTURE_PREVIEW_BASE_DATE.getTime();

  if (token.startsWith('expired-')) {
    throw new AppError('gone', `Mock: invitation expired for token ${token}`);
  }
  if (token.startsWith('valid-') || token.startsWith('tutoring-')) {
    const isTutoring = token.startsWith('tutoring-');
    return {
      schoolName: isTutoring ? 'My Students' : 'Nordic Language Academy',
      schoolSlug: isTutoring ? '' : 'nordic-language-academy',
      role: isTutoring ? 'STUDENT' : 'TEACHER',
      kind: 'register',
      email: 'invite@example.com',
      invitedByName: isTutoring ? 'Tutor Owner' : 'School Owner',
      status: 'pending',
      expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (token.startsWith('revoked-')) {
    return {
      schoolName: 'Nordic Language Academy',
      schoolSlug: 'nordic-language-academy',
      role: 'STUDENT',
      kind: 'register',
      email: 'invite@example.com',
      invitedByName: 'School Owner',
      status: 'revoked',
      expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (token.startsWith('accepted-')) {
    return {
      schoolName: 'Nordic Language Academy',
      schoolSlug: 'nordic-language-academy',
      role: 'STUDENT',
      kind: 'register',
      email: 'invite@example.com',
      invitedByName: 'School Owner',
      status: 'accepted',
      expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  throw new AppError('not_found', `Mock: no invitation for token ${token}`);
}

// ── Mock provider ─────────────────────────────────────────────────────────────

export const mockProvider: InvitationsProvider = {
  async preview(token) {
    return mockPreview(token);
  },

  async list(_schoolId, filter) {
    let items = schoolStore.map((i) => ({ ...i }));
    if (filter?.role) items = items.filter((i) => i.role === filter.role);
    if (filter?.status) items = items.filter((i) => i.status === filter.status);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      items = items.filter(
        (i) =>
          i.email.toLowerCase().includes(q) ||
          (i.targetGroupName ?? '').toLowerCase().includes(q),
      );
    }
    return items;
  },

  async resend(_schoolId, invitationId) {
    const inv = find(schoolStore, invitationId);
    return doResend(inv);
  },

  async revoke(_schoolId, invitationId) {
    const inv = find(schoolStore, invitationId);
    doRevoke(inv);
  },

  async listTutoring() {
    return tutoringStore.map((i) => ({ ...i }));
  },

  async resendTutoring(invitationId) {
    const inv = find(tutoringStore, invitationId);
    return doResend(inv);
  },

  async revokeTutoring(invitationId) {
    const inv = find(tutoringStore, invitationId);
    doRevoke(inv);
  },
};

/** Reset in-memory state to fixtures (used in tests). */
export function resetMockStore(): void {
  schoolStore = cloneFixtures(FIXTURE_INVITATIONS);
  tutoringStore = cloneFixtures(FIXTURE_TUTORING_INVITATIONS);
}
