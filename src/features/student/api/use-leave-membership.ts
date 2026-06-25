'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { studentKeys } from './keys';

export function useLeaveMembership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (membershipId: string) => {
      const res = await fetch(`/api/enrollment/memberships/${membershipId}/leave`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to leave school');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studentKeys.schools() });
    },
  });
}
