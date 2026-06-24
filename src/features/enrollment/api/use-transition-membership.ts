'use client';

import { useMutation } from '@tanstack/react-query';

import type { MembershipStatus } from '../types';

export interface TransitionMembershipInput {
  membershipId: string;
  schoolId: string;
  to: MembershipStatus;
}

export function useTransitionMembership() {
  return useMutation({
    mutationFn: async ({ membershipId, schoolId, to }: TransitionMembershipInput) => {
      const res = await fetch(`/api/enrollment/memberships/${membershipId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, to }),
      });
      if (!res.ok) throw new Error('Transition failed');
    },
  });
}
