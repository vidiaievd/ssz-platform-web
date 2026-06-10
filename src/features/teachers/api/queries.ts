import 'server-only';
import { cache } from 'react';

import type {
  TeacherLoadRow,
  WorkloadKpis,
  Vacancy,
  RoomLoad,
  Alert,
  Absence,
  SubstituteRequest,
  SubstituteCandidate,
  CurriculumPlan,
  ForecastResult,
  ForecastParams,
  AvailabilityBlock,
} from '@/features/teachers/types';

// ── Fetcher result types ──────────────────────────────────────────────────────

export type CommandCenterResponse = {
  kpis: WorkloadKpis;
  teachers: TeacherLoadRow[];
  violations: Alert[];
  vacancies: Vacancy[];
  roomLoad: RoomLoad[];
};

type Unavailable = { status: 'unavailable' };

function makeUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}${path}`;
}

async function safeFetch<T>(url: string, init?: RequestInit): Promise<T | Unavailable> {
  try {
    const res = await fetch(url, { ...init, cache: 'no-store' });
    if (!res.ok) return { status: 'unavailable' };
    return (await res.json()) as T;
  } catch {
    return { status: 'unavailable' };
  }
}

// ── RSC fetchers (with React cache for deduplication) ────────────────────────

export const getCommandCenter = cache(async (schoolId: string) => {
  return safeFetch<CommandCenterResponse>(
    makeUrl(`/api/schools/${schoolId}/scheduling/command-center`),
    { next: { tags: [`school-${schoolId}-teachers`] } },
  );
});

export const getTeacherAvailability = cache(async (teacherId: string) => {
  return safeFetch<AvailabilityBlock[]>(
    makeUrl(`/api/schools/any/teachers/${teacherId}/availability`),
    { next: { tags: [`teacher-${teacherId}-availability`] } },
  );
});

export const getAbsences = cache(async (schoolId: string) => {
  return safeFetch<Absence[]>(
    makeUrl(`/api/schools/${schoolId}/teachers/absences`),
    { next: { tags: [`school-${schoolId}-absences`] } },
  );
});

export const getCoverQueue = cache(async (schoolId: string) => {
  return safeFetch<SubstituteRequest[]>(
    makeUrl(`/api/schools/${schoolId}/scheduling/substitutions`),
    { next: { tags: [`school-${schoolId}-substitutions`] } },
  );
});

export const getCandidates = cache(async (requestId: string) => {
  return safeFetch<SubstituteCandidate[]>(
    makeUrl(`/api/schools/any/scheduling/substitutions/${requestId}/candidates`),
    { next: { tags: [`substitution-${requestId}-candidates`] } },
  );
});

export const getCurriculum = cache(async (groupId: string) => {
  return safeFetch<CurriculumPlan>(
    makeUrl(`/api/schools/any/curriculum/${groupId}`),
    { next: { tags: [`curriculum-${groupId}`] } },
  );
});

export const getForecast = cache(
  async (schoolId: string, params: ForecastParams) => {
    return safeFetch<ForecastResult>(
      makeUrl(`/api/schools/${schoolId}/scheduling/forecast`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
    );
  },
);
