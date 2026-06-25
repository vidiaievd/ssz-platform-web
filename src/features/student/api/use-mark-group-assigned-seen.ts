'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { studentKeys } from './keys';

export interface MarkGroupAssignedSeenInput {
  membershipId: string;
  schoolId: string;
}

export function useMarkGroupAssignedSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ membershipId, schoolId }: MarkGroupAssignedSeenInput) => {
      const res = await fetch(`/api/enrollment/memberships/${membershipId}/mark-group-assigned-seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId }),
      });
      if (!res.ok) throw new Error('Failed to dismiss banner');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studentKeys.schools() });
    },
  });
}
