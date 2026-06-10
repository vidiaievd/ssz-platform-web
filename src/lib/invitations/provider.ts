import type { Invitation, InvitationRole, InvitationStatus } from '@/features/invitations/types';
import type { ISODate } from '@/features/groups/types';

export type ResendResult = {
  expiresAt: ISODate;
  resendCount: number;
  lastSentAt: ISODate;
};

export interface InvitationsProvider {
  list(
    schoolId: string,
    filter?: {
      role?: InvitationRole;
      status?: InvitationStatus;
      search?: string;
    },
  ): Promise<Invitation[]>;

  resend(schoolId: string, invitationId: string): Promise<ResendResult>;
  revoke(schoolId: string, invitationId: string): Promise<void>;

  listTutoring(): Promise<Invitation[]>;
  resendTutoring(invitationId: string): Promise<ResendResult>;
  revokeTutoring(invitationId: string): Promise<void>;
}

export function getInvitationsProvider(): InvitationsProvider {
  if (process.env.INVITATIONS_BACKEND === 'real') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./real').realProvider as InvitationsProvider;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./mock').mockProvider as InvitationsProvider;
}
