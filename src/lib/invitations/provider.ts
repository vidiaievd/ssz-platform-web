import type { Invitation, InvitationRole, InvitationStatus, InvitePreview } from '@/features/invitations/types';
import type { ISODate } from '@/features/groups/types';

export type ResendResult = {
  expiresAt: ISODate;
  resendCount: number;
  lastSentAt: ISODate;
};

export interface InvitationsProvider {
  /**
   * Public preview of an invitation by token — no auth required.
   * Throws AppError('not_found') when token is unknown.
   * Throws AppError('gone') when the server returns 410 (expired/revoked).
   */
  preview(token: string): Promise<InvitePreview>;

  list(
    schoolId: string,
    filter?: {
      role?: InvitationRole;
      status?: InvitationStatus;
      search?: string;
    },
  ): Promise<Invitation[]>;

  /** Cheap count without transferring the full list. Falls back to list().length if not implemented. */
  count(
    schoolId: string,
    filter?: { status?: InvitationStatus; role?: InvitationRole },
  ): Promise<number>;

  resend(schoolId: string, invitationId: string): Promise<ResendResult>;
  revoke(schoolId: string, invitationId: string): Promise<void>;

  listTutoring(): Promise<Invitation[]>;
  resendTutoring(invitationId: string): Promise<ResendResult>;
  revokeTutoring(invitationId: string): Promise<void>;
}

export function getInvitationsProvider(): InvitationsProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./real').realProvider as InvitationsProvider;
}
