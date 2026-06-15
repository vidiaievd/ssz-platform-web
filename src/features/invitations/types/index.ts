import type { ISODate } from '@/features/groups/types';

export type InvitationRole = 'ADMIN' | 'CONTENT_ADMIN' | 'TEACHER' | 'STUDENT' | 'SCHEDULER';
export type InvitationKind = 'register' | 'onboard_existing';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export type InvitePreview = {
  schoolName: string;
  schoolSlug: string;
  role: InvitationRole;
  kind: InvitationKind;
  email: string;
  invitedByName: string | null;
  status: InvitationStatus;
  expiresAt: ISODate;
  /** Optional — set when school entered teacher name at invite time (TI.1). */
  firstName?: string | null;
  lastName?: string | null;
  /** Teacher-only: languages+levels the invite is for. */
  teachingLanguages?: Array<{ code: string; level: string }> | null;
};
export type InvitationAudience = 'all' | 'teachers' | 'students' | 'staff';

export interface Invitation {
  invitationId: string;
  email: string;
  role: InvitationRole;
  kind: InvitationKind;
  /** Server-derived (§5.1); front derives as fallback when absent. */
  status: InvitationStatus;
  targetGroupId: string | null;
  targetGroupName: string | null;
  invitedByName: string | null;
  createdAt: ISODate;
  expiresAt: ISODate;
  acceptedAt: ISODate | null;
  lastSentAt: ISODate;
  resendCount: number;
  /** Only for pending, if backend returns it (§5.2 open question). */
  token?: string | null;
}
