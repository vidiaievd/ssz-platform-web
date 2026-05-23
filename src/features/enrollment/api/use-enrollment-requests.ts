'use client';

import { useQuery } from '@tanstack/react-query';

import type { EnrollmentRequestsResponse } from '../types';
import { enrollmentKeys } from './keys';

export function useEnrollmentRequests() {
  return useQuery<EnrollmentRequestsResponse>({
    queryKey: enrollmentKeys.requests(),
    queryFn: async () => {
      const res = await fetch('/api/enrollment/requests');
      if (!res.ok) throw new Error('Failed to fetch enrollment requests');
      return res.json() as Promise<EnrollmentRequestsResponse>;
    },
    staleTime: 30_000,
  });
}
