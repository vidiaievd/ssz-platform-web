import type { Invitation } from '@/features/invitations/types';
import { deriveInvitationStatus } from './status';

// Fixed "now" for determinism: 2026-06-10T12:00:00Z
const BASE_NOW = new Date('2026-06-10T12:00:00Z').getTime();

export const FIXTURE_PREVIEW_BASE_DATE = new Date('2026-06-10T12:00:00Z');

function iso(offsetDays: number): string {
  return new Date(BASE_NOW + offsetDays * 24 * 60 * 60 * 1000).toISOString();
}

function make(partial: Omit<Invitation, 'status'> & { _revoked?: boolean }): Invitation {
  const { _revoked, ...inv } = partial;
  const status = deriveInvitationStatus(
    { acceptedAt: inv.acceptedAt, expiresAt: inv.expiresAt, revoked: _revoked },
    BASE_NOW,
  );
  return { ...inv, status };
}

export const FIXTURE_INVITATIONS: Invitation[] = [
  // pending TEACHER, expires in 7 days, has targetGroup
  make({
    invitationId: 'inv-teacher-pending',
    email: 'alice@example.com',
    role: 'TEACHER',
    kind: 'register',
    targetGroupId: 'group-a1',
    targetGroupName: 'English A1 Morning',
    invitedByName: 'School Owner',
    createdAt: iso(-3),
    expiresAt: iso(7),
    acceptedAt: null,
    lastSentAt: iso(-3),
    resendCount: 0,
    token: 'tok-teacher-pending',
  }),

  // pending TEACHER, expiring soon (within 2 days)
  make({
    invitationId: 'inv-teacher-soon',
    email: 'bob@example.com',
    role: 'TEACHER',
    kind: 'register',
    targetGroupId: null,
    targetGroupName: null,
    invitedByName: 'School Owner',
    createdAt: iso(-14),
    expiresAt: iso(1),
    acceptedAt: null,
    lastSentAt: iso(-14),
    resendCount: 2,
    token: 'tok-teacher-soon',
  }),

  // accepted STUDENT
  make({
    invitationId: 'inv-student-accepted',
    email: 'cara@example.com',
    role: 'STUDENT',
    kind: 'register',
    targetGroupId: 'group-b1',
    targetGroupName: 'Norwegian B1 Evening',
    invitedByName: 'School Admin',
    createdAt: iso(-10),
    expiresAt: iso(4),
    acceptedAt: iso(-5),
    lastSentAt: iso(-10),
    resendCount: 0,
  }),

  // expired STUDENT
  make({
    invitationId: 'inv-student-expired',
    email: 'dan@example.com',
    role: 'STUDENT',
    kind: 'onboard_existing',
    targetGroupId: 'group-c2',
    targetGroupName: 'Ukrainian C2 Online',
    invitedByName: null,
    createdAt: iso(-20),
    expiresAt: iso(-3),
    acceptedAt: null,
    lastSentAt: iso(-20),
    resendCount: 1,
  }),

  // revoked ADMIN (staff)
  make({
    invitationId: 'inv-admin-revoked',
    email: 'eve@example.com',
    role: 'ADMIN',
    kind: 'register',
    targetGroupId: null,
    targetGroupName: null,
    invitedByName: 'School Owner',
    createdAt: iso(-7),
    expiresAt: iso(7),
    acceptedAt: null,
    lastSentAt: iso(-7),
    resendCount: 0,
    _revoked: true,
  }),

  // pending CONTENT_ADMIN (staff), resendCount > 0, recently sent (within cooldown)
  make({
    invitationId: 'inv-content-admin-pending',
    email: 'frank@example.com',
    role: 'CONTENT_ADMIN',
    kind: 'register',
    targetGroupId: null,
    targetGroupName: null,
    invitedByName: 'School Owner',
    createdAt: iso(-5),
    expiresAt: iso(9),
    acceptedAt: null,
    lastSentAt: new Date(BASE_NOW - 60_000).toISOString(), // 60s ago → inside 120s cooldown
    resendCount: 1,
  }),

  // pending SCHEDULER (staff)
  make({
    invitationId: 'inv-scheduler-pending',
    email: 'grace@example.com',
    role: 'SCHEDULER',
    kind: 'register',
    targetGroupId: null,
    targetGroupName: null,
    invitedByName: 'School Owner',
    createdAt: iso(-1),
    expiresAt: iso(13),
    acceptedAt: null,
    lastSentAt: iso(-1),
    resendCount: 0,
  }),
];

// Tutoring-flavour (no targetGroup, only STUDENT-role)
export const FIXTURE_TUTORING_INVITATIONS: Invitation[] = [
  make({
    invitationId: 'inv-tutor-pending',
    email: 'hana@example.com',
    role: 'STUDENT',
    kind: 'register',
    targetGroupId: null,
    targetGroupName: null,
    invitedByName: 'Tutor Name',
    createdAt: iso(-2),
    expiresAt: iso(12),
    acceptedAt: null,
    lastSentAt: iso(-2),
    resendCount: 0,
    token: 'tok-tutor-pending',
  }),

  make({
    invitationId: 'inv-tutor-accepted',
    email: 'ivan@example.com',
    role: 'STUDENT',
    kind: 'onboard_existing',
    targetGroupId: null,
    targetGroupName: null,
    invitedByName: 'Tutor Name',
    createdAt: iso(-8),
    expiresAt: iso(6),
    acceptedAt: iso(-4),
    lastSentAt: iso(-8),
    resendCount: 0,
  }),
];
