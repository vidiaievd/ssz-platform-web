import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { Invitation } from '@/features/invitations/types';
import type { InvitationsProvider, ResendResult } from './provider';

// DTOs as returned by org-service / tutoring endpoints

type SchoolInvitationDto = Omit<Invitation, 'token'>;

type TutoringInvitationDto = {
  invitationId: string;
  email: string;
  status: Invitation['status'];
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  lastSentAt: string;
  resendCount: number;
};

type ResendResponseDto = {
  invitationId: string;
  expiresAt: string;
  deliveryStatus: string;
  resendCount: number;
};

export const realProvider: InvitationsProvider = {
  async list(schoolId, filter) {
    const data = await serverFetch<SchoolInvitationDto[]>({
      service: 'organization',
      path: `/schools/${schoolId}/invitations`,
      query: {
        role: filter?.role,
        status: filter?.status,
        search: filter?.search,
      },
    });
    return data;
  },

  async resend(schoolId, invitationId): Promise<ResendResult> {
    const data = await serverFetch<ResendResponseDto>({
      service: 'organization',
      path: `/schools/${schoolId}/invitations/${invitationId}/resend`,
      method: 'POST',
    });
    return {
      expiresAt: data.expiresAt,
      resendCount: data.resendCount,
      lastSentAt: new Date().toISOString(),
    };
  },

  async revoke(schoolId, invitationId) {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/invitations/${invitationId}`,
      method: 'DELETE',
    });
  },

  async listTutoring() {
    const data = await serverFetch<TutoringInvitationDto[]>({
      service: 'organization',
      path: '/tutoring/group/invitations',
    });
    return data.map(
      (dto): Invitation => ({
        ...dto,
        role: 'STUDENT',
        kind: 'register',
        targetGroupId: null,
        targetGroupName: null,
        invitedByName: null,
      }),
    );
  },

  async resendTutoring(invitationId): Promise<ResendResult> {
    const data = await serverFetch<ResendResponseDto>({
      service: 'organization',
      path: `/tutoring/group/invitations/${invitationId}/resend`,
      method: 'POST',
    });
    return {
      expiresAt: data.expiresAt,
      resendCount: data.resendCount,
      lastSentAt: new Date().toISOString(),
    };
  },

  async revokeTutoring(invitationId) {
    await serverFetch({
      service: 'organization',
      path: `/tutoring/group/invitations/${invitationId}`,
      method: 'DELETE',
    });
  },
};
