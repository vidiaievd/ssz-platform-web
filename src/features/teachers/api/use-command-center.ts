'use client';

import { useQuery, type DefinedUseQueryResult, type UseQueryResult } from '@tanstack/react-query';

import { teacherKeys } from './keys';
import type { CommandCenterResponse } from './queries';

async function fetchCommandCenter(schoolId: string): Promise<CommandCenterResponse> {
  const res = await fetch(`/api/schools/${schoolId}/scheduling/command-center`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch command center');
  return (await res.json()) as CommandCenterResponse;
}

export function useCommandCenter(
  schoolId: string,
  opts: { initialData: CommandCenterResponse; refetchInterval?: number },
): DefinedUseQueryResult<CommandCenterResponse, Error>;
export function useCommandCenter(
  schoolId: string,
  opts?: { initialData?: undefined; refetchInterval?: number },
): UseQueryResult<CommandCenterResponse, Error>;
export function useCommandCenter(
  schoolId: string,
  opts?: { initialData?: CommandCenterResponse; refetchInterval?: number },
) {
  return useQuery({
    queryKey: teacherKeys.commandCenter(schoolId),
    queryFn: () => fetchCommandCenter(schoolId),
    enabled: Boolean(schoolId),
    staleTime: 5 * 60 * 1000,
    initialData: opts?.initialData,
    refetchInterval: opts?.refetchInterval,
  }) as DefinedUseQueryResult<CommandCenterResponse, Error>;
}
