'use client';

import { useQuery } from '@tanstack/react-query';

import { groupKeys } from './keys';
import type { AgeBand } from '../types';

/**
 * Which age bands a school offers, gating the age-band selector on the
 * group create wizard and edit dialog (configured in onboarding settings).
 */
export function useSchoolAgeBands(schoolSlug: string) {
  return useQuery<AgeBand[]>({
    queryKey: groupKeys.onboardingSettings(schoolSlug),
    queryFn: async () => {
      const res = await fetch(`/api/enrollment/schools/${schoolSlug}/settings`);
      if (!res.ok) throw new Error('Failed to fetch onboarding settings');
      const data: { ageBands: { values: AgeBand[] } } = await res.json();
      return data.ageBands.values;
    },
    staleTime: 60_000,
  });
}
