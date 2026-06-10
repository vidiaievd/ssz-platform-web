'use client';

import { InvitationsTable } from '@/features/invitations/components/invitations-table';
import {
  resendTutoringInvitation,
  revokeTutoringInvitation,
} from '@/features/invitations/api/mutations';
import type { Invitation } from '@/features/invitations/types';
import type { ResendResult, RevokeResult } from '@/features/invitations/api/mutations';

// Adapt tutoring mutations to the (schoolId, invitationId) signature InvitationsTable expects.
async function resend(_schoolId: string, invitationId: string): Promise<ResendResult> {
  return resendTutoringInvitation(invitationId);
}

async function revoke(_schoolId: string, invitationId: string): Promise<RevokeResult> {
  return revokeTutoringInvitation(invitationId);
}

const TUTORING_MUTATIONS = { resend, revoke };

type Props = { invitations: Invitation[] };

export function TutoringInvitationsTableClient({ invitations }: Props) {
  return (
    <InvitationsTable
      invitations={invitations}
      schoolId=""
      mutations={TUTORING_MUTATIONS}
    />
  );
}
