import type { Invitation, InvitationStatus, InvitationAudience } from '@/features/invitations/types';

export type StatusInput = Pick<
  Invitation,
  'acceptedAt' | 'expiresAt'
> & {
  revoked?: boolean;
  status?: InvitationStatus;
};

// ── Core derive ───────────────────────────────────────────────────────────────

/**
 * Derives invitation status from fields.
 * Priority: accepted > revoked > expired > pending.
 * If `inv.status` is already set (server-authoritative), it is returned as-is.
 */
export function deriveInvitationStatus(
  inv: StatusInput,
  now: number = Date.now(),
): InvitationStatus {
  if (inv.acceptedAt) return 'accepted';
  if (inv.revoked) return 'revoked';
  if (new Date(inv.expiresAt).getTime() < now) return 'expired';
  return 'pending';
}

// ── Expiry helpers ────────────────────────────────────────────────────────────

export function isExpiringSoon(
  inv: Pick<Invitation, 'expiresAt' | 'acceptedAt' | 'status'>,
  withinDays: number = 2,
  now: number = Date.now(),
): boolean {
  if (inv.acceptedAt || inv.status === 'accepted' || inv.status === 'expired' || inv.status === 'revoked') {
    return false;
  }
  const expiresMs = new Date(inv.expiresAt).getTime();
  const withinMs = withinDays * 24 * 60 * 60 * 1000;
  return expiresMs > now && expiresMs - now <= withinMs;
}

export type ExpiryLabelKind = 'dash' | 'expired' | 'soon' | 'days' | 'hours';

export function expiryLabelKind(
  inv: Pick<Invitation, 'expiresAt' | 'acceptedAt' | 'status'>,
  now: number = Date.now(),
): ExpiryLabelKind {
  if (inv.acceptedAt || inv.status === 'accepted') return 'dash';
  const expiresMs = new Date(inv.expiresAt).getTime();
  if (expiresMs <= now) return 'expired';
  const remainingMs = expiresMs - now;
  if (remainingMs <= 2 * 24 * 60 * 60 * 1000) return 'soon';
  if (remainingMs <= 48 * 60 * 60 * 1000) return 'hours';
  return 'days';
}

// ── Throttle ──────────────────────────────────────────────────────────────────

/** Returns true when resend is allowed (cooldown has passed). Default 120 s. */
export function canResend(
  inv: Pick<Invitation, 'lastSentAt' | 'status'>,
  cooldownMs: number = 120_000,
  now: number = Date.now(),
): boolean {
  if (inv.status === 'accepted' || inv.status === 'revoked') return false;
  return now - new Date(inv.lastSentAt).getTime() >= cooldownMs;
}

/** Milliseconds remaining in the resend cooldown (0 if cooldown has passed). */
export function resendCooldownRemaining(
  inv: Pick<Invitation, 'lastSentAt'>,
  cooldownMs: number = 120_000,
  now: number = Date.now(),
): number {
  const elapsed = now - new Date(inv.lastSentAt).getTime();
  return Math.max(0, cooldownMs - elapsed);
}

// ── Audience predicate ────────────────────────────────────────────────────────

export function audiencePredicate(
  audience: InvitationAudience,
): (inv: Pick<Invitation, 'role'>) => boolean {
  switch (audience) {
    case 'teachers':
      return (inv) => inv.role === 'TEACHER';
    case 'students':
      return (inv) => inv.role === 'STUDENT';
    case 'staff':
      return (inv) =>
        inv.role === 'ADMIN' ||
        inv.role === 'CONTENT_ADMIN' ||
        inv.role === 'SCHEDULER';
    case 'all':
      return () => true;
  }
}

// ── Actionability ─────────────────────────────────────────────────────────────

/** Invitation has resend/revoke actions available. */
export function isActionable(inv: Pick<Invitation, 'status'>): boolean {
  return inv.status === 'pending' || inv.status === 'expired';
}
