'use client';

import { useQuery } from '@tanstack/react-query';

import { groupKeys } from './keys';
import type { Slot, TeacherAvailability } from '../types';

type ProposedSlot = Pick<Slot, 'day' | 'start' | 'end'>;

/**
 * Derived per-teacher availability (free/conflict/absent) for a proposed
 * weekly slot set — used while slots are still being edited (create wizard),
 * where the committed-slots-based server computation doesn't apply yet.
 */
export function useTeachersAvailability(schoolId: string, slots: ProposedSlot[]) {
  const slotsKey = JSON.stringify(slots.map((s) => ({ day: s.day, start: s.start, end: s.end })));

  return useQuery<TeacherAvailability[]>({
    queryKey: groupKeys.availability(schoolId, slotsKey),
    queryFn: async () => {
      const params = new URLSearchParams({ slots: slotsKey });
      const res = await fetch(`/api/schools/${schoolId}/teachers/availability?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch teacher availability');
      return res.json();
    },
    enabled: slots.length > 0,
    staleTime: 10_000,
  });
}
