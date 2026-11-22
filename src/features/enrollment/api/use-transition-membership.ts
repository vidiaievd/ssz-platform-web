'use client';

import { useMutation } from '@tanstack/react-query';

import type { MembershipStatus } from '../types';

export interface TransitionMembershipInput {
  membershipId: string;
  schoolId: string;
  to: MembershipStatus;
}

export class TransitionError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public schoolStatus?: string,
  ) {
    super(message);
    this.name = 'TransitionError';
  }
}

/** The school has no student seat left for this approval (plan 90, phase 4). */
export function isSeatsExhaustedTransition(error: unknown): boolean {
  return error instanceof TransitionError && error.status === 409 && error.code === 'SEATS_EXHAUSTED';
}

/** The school is read only (suspended / closed): `suspended` / `closed`, else `null`. */
export function schoolNotActiveTransition(error: unknown): 'suspended' | 'closed' | null {
  if (!(error instanceof TransitionError) || error.status !== 409 || error.code !== 'SCHOOL_NOT_ACTIVE') return null;
  return error.schoolStatus === 'closed' ? 'closed' : 'suspended';
}

/** A 409 here means the membership already moved on (e.g. someone else approved it first). */
export function isTransitionConflict(error: unknown): boolean {
  return (
    error instanceof TransitionError &&
    error.status === 409 &&
    error.code !== 'SEATS_EXHAUSTED' &&
    error.code !== 'SCHOOL_NOT_ACTIVE'
  );
}

export function useTransitionMembership() {
  return useMutation({
    mutationFn: async ({ membershipId, schoolId, to }: TransitionMembershipInput) => {
      const res = await fetch(`/api/enrollment/memberships/${membershipId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, to }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string; code?: string; schoolStatus?: string }
          | null;
        throw new TransitionError(body?.error ?? 'Transition failed', res.status, body?.code, body?.schoolStatus);
      }
    },
  });
}
