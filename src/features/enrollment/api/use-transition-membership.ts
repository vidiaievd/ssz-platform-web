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
  ) {
    super(message);
    this.name = 'TransitionError';
  }
}

/** A 409 here means the membership already moved on (e.g. someone else approved it first). */
export function isTransitionConflict(error: unknown): boolean {
  return error instanceof TransitionError && error.status === 409;
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
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new TransitionError(body?.error ?? 'Transition failed', res.status);
      }
    },
  });
}
