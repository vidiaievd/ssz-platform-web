import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';
import type { Invitation, InvitePreview } from '@/features/invitations/types';
import type { InvitationsProvider, ResendResult } from './provider';

// DTOs as returned by org-service / tutoring endpoints

type PreviewDto = InvitePreview;

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
  async preview(token): Promise<InvitePreview> {
    // Try school invitation first; if not found try tutoring invitation.
    try {
      return await serverFetch<PreviewDto>({
        service: 'organization',
        path: `/schools/invitations/${token}`,
        anonymous: true,
      });
    } catch (schoolErr) {
      if (schoolErr instanceof AppError && schoolErr.code === 'not_found') {
        try {
          return await serverFetch<PreviewDto>({
            service: 'organization',
            path: `/tutoring/invitations/${token}`,
            anonymous: true,
          });
        } catch (tutoringErr) {
          // Propagate tutoring error (not_found / gone)
          throw tutoringErr;
        }
      }
      throw schoolErr;
    }
  },

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

  async count(schoolId, filter) {
    try {
      const data = await serverFetch<{ count: number }>({
        service: 'organization',
        path: `/schools/${schoolId}/invitations/count`,
        query: {
          status: filter?.status,
          role: filter?.role,
        },
      });
      return data.count;
    } catch {
      // B2 not yet deployed — fall back to list
      const items = await realProvider.list(schoolId, { status: filter?.status, role: filter?.role });
      return items.length;
    }
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
