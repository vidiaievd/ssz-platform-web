import 'server-only';

import { getInvitationsProvider } from '@/lib/invitations/provider';
import { audiencePredicate, deriveInvitationStatus } from '@/lib/invitations/status';
import type { Invitation, InvitationAudience, InvitationStatus } from '@/features/invitations/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_STATUSES = new Set<string>(['pending', 'accepted', 'expired', 'revoked']);

function ensureStatus(inv: Invitation): Invitation {
  // Normalize backend casing (e.g. 'Pending', 'PENDING' → 'pending').
  const normalized = (inv.status as string | undefined)?.toLowerCase() as InvitationStatus | undefined;
  if (normalized && VALID_STATUSES.has(normalized)) {
    return normalized === inv.status ? inv : { ...inv, status: normalized };
  }
  // Status absent or unrecognised — derive from date fields.
  return { ...inv, status: deriveInvitationStatus(inv) };
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
