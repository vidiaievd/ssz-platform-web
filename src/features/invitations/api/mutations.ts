'use server';

import { revalidateTag } from 'next/cache';
import { AppError } from '@/lib/errors/app-error';
import { serverFetch } from '@/lib/api/server-fetcher';
import { getInvitationsProvider } from '@/lib/invitations/provider';
import { invitationCacheTags } from './keys';
import type { ISODate } from '@/features/groups/types';

function invalidate(tag: string) {
  revalidateTag(tag, {});
}

// ── Result types ──────────────────────────────────────────────────────────────

export type ResendMutationReason = 'already-accepted' | 'throttled' | 'gone' | 'error';
export type RevokeMutationReason = 'already-accepted' | 'gone' | 'error';

export type ResendResult =
  | { ok: true; expiresAt: ISODate; resendCount: number; lastSentAt: ISODate }
  | { ok: false; reason: ResendMutationReason };

export type RevokeResult =
  | { ok: true }
  | { ok: false; reason: RevokeMutationReason };

// ── Error mapping ─────────────────────────────────────────────────────────────

function mapResendError(e: unknown): ResendResult {
  if (e instanceof AppError) {
    if (e.code === 'conflict') return { ok: false, reason: 'already-accepted' };
    if (e.code === 'rate_limited') return { ok: false, reason: 'throttled' };
    if (e.code === 'not_found') return { ok: false, reason: 'gone' };
  }
  // HTTP status codes forwarded from BFF response
  if (e instanceof Error) {
    if (e.message.includes('409')) return { ok: false, reason: 'already-accepted' };
    if (e.message.includes('429')) return { ok: false, reason: 'throttled' };
    if (e.message.includes('410')) return { ok: false, reason: 'gone' };
  }
  return { ok: false, reason: 'error' };
}

function mapRevokeError(e: unknown): RevokeResult {
  if (e instanceof AppError) {
    if (e.code === 'conflict') return { ok: false, reason: 'already-accepted' };
    if (e.code === 'not_found') return { ok: false, reason: 'gone' };
  }
  if (e instanceof Error) {
    if (e.message.includes('409')) return { ok: false, reason: 'already-accepted' };
    if (e.message.includes('410')) return { ok: false, reason: 'gone' };
  }
  return { ok: false, reason: 'error' };
}

// ── Accept invitation ─────────────────────────────────────────────────────────

export type AcceptInvitationReason = 'unauthenticated' | 'terminal' | 'email_mismatch' | 'error';

export type AcceptInvitationResult =
  | { ok: true; alreadyMember: boolean }
  | { ok: false; reason: AcceptInvitationReason };

export async function acceptInvitation(token: string): Promise<AcceptInvitationResult> {
  try {
    const res = await serverFetch<{ schoolId?: string } | null>({
      service: 'organization',
      path: `/schools/invitations/${token}/accept`,
      method: 'POST',
    });
    if (res?.schoolId) {
      invalidate(`school-${res.schoolId}-teachers`);
    }
    return { ok: true, alreadyMember: false };
  } catch (schoolErr) {
    if (schoolErr instanceof AppError && schoolErr.code === 'not_found') {
      // Fallback: tutoring invitation
      try {
        await serverFetch({
          service: 'organization',
          path: `/tutoring/invitations/${token}/accept`,
          method: 'POST',
        });
        return { ok: true, alreadyMember: false };
      } catch (tutoringErr) {
        return mapAcceptError(tutoringErr);
      }
    }
    if (schoolErr instanceof AppError && schoolErr.code === 'conflict') {
      return { ok: true, alreadyMember: true };
    }
    return mapAcceptError(schoolErr);
  }
}

function mapAcceptError(e: unknown): AcceptInvitationResult {
  if (e instanceof AppError) {
    if (e.code === 'unauthenticated') return { ok: false, reason: 'unauthenticated' };
    if (e.code === 'gone') return { ok: false, reason: 'terminal' };
    if (e.code === 'not_found') return { ok: false, reason: 'terminal' };
    if (e.code === 'forbidden') return { ok: false, reason: 'email_mismatch' };
    if (e.code === 'conflict') return { ok: true, alreadyMember: true };
  }
  return { ok: false, reason: 'error' };
}

// ── School mutations ──────────────────────────────────────────────────────────

export async function resendInvitation(
  schoolId: string,
  invitationId: string,
): Promise<ResendResult> {
  try {
    const provider = getInvitationsProvider();
    const result = await provider.resend(schoolId, invitationId);
    invalidate(invitationCacheTags.list(schoolId));
    return { ok: true, ...result };
  } catch (e) {
    return mapResendError(e);
  }
}

export async function revokeInvitation(
  schoolId: string,
  invitationId: string,
): Promise<RevokeResult> {
  try {
    const provider = getInvitationsProvider();
    await provider.revoke(schoolId, invitationId);
    invalidate(invitationCacheTags.list(schoolId));
    return { ok: true };
  } catch (e) {
    return mapRevokeError(e);
  }
}

// ── Tutoring mutations ────────────────────────────────────────────────────────

export async function resendTutoringInvitation(
  invitationId: string,
): Promise<ResendResult> {
  try {
    const provider = getInvitationsProvider();
    const result = await provider.resendTutoring(invitationId);
    invalidate(invitationCacheTags.tutoring());
    return { ok: true, ...result };
  } catch (e) {
    return mapResendError(e);
  }
}

export async function revokeTutoringInvitation(
  invitationId: string,
): Promise<RevokeResult> {
  try {
    const provider = getInvitationsProvider();
    await provider.revokeTutoring(invitationId);
    invalidate(invitationCacheTags.tutoring());
    return { ok: true };
  } catch (e) {
    return mapRevokeError(e);
  }
}
