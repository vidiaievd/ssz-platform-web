'use client';

import { useQuery, type DefinedUseQueryResult, type UseQueryResult } from '@tanstack/react-query';

import { groupKeys } from './keys';
import type { StudentCandidate } from './queries';

// ── Candidates for an existing group's add-students modal ─────────────────────

type GroupCandidatesResult = {
  groupName: string;
  currentCount: number;
  capacity: { min: number; max: number };
  candidates: StudentCandidate[];
};

async function fetchGroupCandidates(schoolId: string, groupId: string): Promise<GroupCandidatesResult> {
  const res = await fetch(`/api/schools/${schoolId}/groups/${groupId}/candidates`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch student candidates');
  return (await res.json()) as GroupCandidatesResult;
}

export function useStudentCandidates(
  schoolId: string,
  groupId: string,
  opts: { initialData: GroupCandidatesResult },
): DefinedUseQueryResult<GroupCandidatesResult, Error>;
export function useStudentCandidates(
  schoolId: string,
  groupId: string,
  opts?: { initialData?: undefined },
): UseQueryResult<GroupCandidatesResult, Error>;
export function useStudentCandidates(
  schoolId: string,
  groupId: string,
  opts?: { initialData?: GroupCandidatesResult },
) {
  return useQuery({
    queryKey: groupKeys.studentCandidates(schoolId, groupId),
    queryFn: () => fetchGroupCandidates(schoolId, groupId),
    enabled: Boolean(schoolId) && Boolean(groupId),
    staleTime: 5 * 60 * 1000,
    initialData: opts?.initialData,
  }) as DefinedUseQueryResult<GroupCandidatesResult, Error>;
}

// ── All school students with STUDENT role — for the new-group creation wizard ──

async function fetchSchoolStudents(schoolId: string): Promise<StudentCandidate[]> {
  const res = await fetch(`/api/schools/${schoolId}/students/candidates`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch school students');
  return (await res.json()) as StudentCandidate[];
}

export function useSchoolStudents(
  schoolId: string,
  opts: { initialData: StudentCandidate[] },
): DefinedUseQueryResult<StudentCandidate[], Error>;
export function useSchoolStudents(
  schoolId: string,
  opts?: { initialData?: undefined },
): UseQueryResult<StudentCandidate[], Error>;
export function useSchoolStudents(schoolId: string, opts?: { initialData?: StudentCandidate[] }) {
  return useQuery({
    queryKey: groupKeys.schoolStudentCandidates(schoolId),
    queryFn: () => fetchSchoolStudents(schoolId),
    enabled: Boolean(schoolId),
    staleTime: 5 * 60 * 1000,
    initialData: opts?.initialData,
  }) as DefinedUseQueryResult<StudentCandidate[], Error>;
}
