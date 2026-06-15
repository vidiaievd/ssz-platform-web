import 'server-only';

import { AppError } from '@/lib/errors';
import { getInvitationsProvider } from '@/lib/invitations/provider';
import type { ISODate } from '@/features/groups/types';

export interface StudentInvitePayload {
  schoolSlug: string;
  schoolName: string;
  /** Email is locked in the registration form — cannot be reassigned. */
  email: string;
  expiresAt: ISODate;
  /** Pre-assigned group from the invite (skips group selection in onboarding). */
  groupId?: string;
}

/**
 * Decodes a student invite token using the InvitationsProvider.
 * Throws AppError('gone') if expired or revoked, ('not_found') if unknown.
 */
export async function decodeStudentInvite(token: string): Promise<StudentInvitePayload> {
  const provider = getInvitationsProvider();
  const preview = await provider.preview(token);

  if (preview.status === 'revoked') {
    throw new AppError('gone', 'Invitation has been revoked');
  }
  if (preview.status === 'expired') {
    throw new AppError('gone', 'Invitation has expired');
  }

  return {
    schoolSlug: preview.schoolSlug,
    schoolName: preview.schoolName,
    email: preview.email,
    expiresAt: preview.expiresAt,
  };
}
