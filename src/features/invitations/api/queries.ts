import 'server-only';

import { getInvitationsProvider } from '@/lib/invitations/provider';
import { audiencePredicate, deriveInvitationStatus } from '@/lib/invitations/status';
import type { Invitation, InvitationAudience, InvitationStatus } from '@/features/invitations/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureStatus(inv: Invitation): Invitation {
  // If server didn't return a derived status, fall back to client derivation.
  if (!inv.status) {
    return { ...inv, status: deriveInvitationStatus(inv) };
  }
  return inv;
}

// ── School ────────────────────────────────────────────────────────────────────

type ListFilter = {
  audience?: InvitationAudience;
  status?: InvitationStatus;
  search?: string;
};

export async function getInvitations(
  schoolId: string,
  filter: ListFilter = {},
): Promise<Invitation[]> {
  const provider = getInvitationsProvider();

  const items = await provider.list(schoolId, { status: filter.status, search: filter.search });
  const withStatus = items.map(ensureStatus);

  if (filter.audience && filter.audience !== 'all') {
    const pred = audiencePredicate(filter.audience);
    return withStatus.filter(pred);
  }

  return withStatus;
}

export async function getPendingCount(
  schoolId: string,
  audience: InvitationAudience = 'all',
): Promise<number> {
  const items = await getInvitations(schoolId, { audience, status: 'pending' });
  return items.length;
}

// ── Tutoring ──────────────────────────────────────────────────────────────────

export async function getTutoringInvitations(): Promise<Invitation[]> {
  const provider = getInvitationsProvider();
  const items = await provider.listTutoring();
  return items.map(ensureStatus);
}
