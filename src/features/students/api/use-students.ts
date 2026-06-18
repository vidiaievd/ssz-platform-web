'use client';

import { useQuery, type DefinedUseQueryResult, type UseQueryResult } from '@tanstack/react-query';

import { studentKeys } from './keys';
import type { StudentsListResult, SegmentKey } from '@/features/students/types';

type ListOpts = { segment?: SegmentKey; search?: string };

async function fetchStudents(
  schoolId: string,
  segment: SegmentKey | undefined,
  search: string | undefined,
): Promise<StudentsListResult> {
  const params = new URLSearchParams();
  if (segment && segment !== 'all') params.set('segment', segment);
  if (search) params.set('search', search);

  const res = await fetch(`/api/schools/${schoolId}/students?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch students');
  return (await res.json()) as StudentsListResult;
}

export function useStudents(
  schoolId: string,
  opts: ListOpts & { initialData: StudentsListResult },
): DefinedUseQueryResult<StudentsListResult, Error>;
export function useStudents(
  schoolId: string,
  opts?: ListOpts & { initialData?: undefined },
): UseQueryResult<StudentsListResult, Error>;
export function useStudents(
  schoolId: string,
  opts?: ListOpts & { initialData?: StudentsListResult },
) {
  const segment = opts?.segment;
  const search = opts?.search;
  return useQuery({
    queryKey: studentKeys.list(schoolId, { segment, search }),
    queryFn: () => fetchStudents(schoolId, segment, search),
    enabled: Boolean(schoolId),
    staleTime: 5 * 60 * 1000,
    initialData: opts?.initialData,
  }) as DefinedUseQueryResult<StudentsListResult, Error>;
}
