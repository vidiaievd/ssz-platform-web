import 'server-only';
import { cache } from 'react';

import { serverFetch } from '@/lib/api/server-fetcher';
import type {
  TeacherLoadRow,
  TeacherRosterRow,
  RosterStatus,
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
  teachersError?: string | null;
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

// ── Roster fetcher ────────────────────────────────────────────────────────────

type OrgMemberDto = {
  userId: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  role?: string;
  langs?: string[];
  maxWeeklyHours?: number;
  status?: string;
  joinedAt?: string;
};

type ProfileSummary = {
  userId: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
};

function mapRosterStatus(s?: string): RosterStatus {
  if (s === 'pending') return 'pending';
  if (s === 'suspended') return 'suspended';
  return 'active';
}

export const getTeacherRoster = cache(async (schoolId: string): Promise<TeacherRosterRow[]> => {
  try {
    const members = await serverFetch<OrgMemberDto[]>({
      service: 'organization',
      path: `/schools/${schoolId}/members`,
      query: { role: 'TEACHER' },
    });

    const teacherMembers = members.filter((m) => !m.role || m.role === 'TEACHER');
    if (teacherMembers.length === 0) return [];

    // Enrich with display name + avatar from profile-service (single source of truth).
    // Falls back to org data if profile-service is unavailable.
    let profileMap = new Map<string, ProfileSummary>();
    try {
      const userIds = teacherMembers.map((m) => m.userId).join(',');
      const profiles = await serverFetch<ProfileSummary[]>({
        service: 'profile',
        path: '/profiles',
        query: { userIds },
      });
      profileMap = new Map(profiles.map((p) => [p.userId, p]));
    } catch {
      // profile-service unavailable — fall back gracefully
    }

    return teacherMembers.map((m): TeacherRosterRow => {
      const profile = profileMap.get(m.userId);
      return {
        userId: m.userId,
        name: profile?.displayName ?? m.name ?? '',
        email: m.email ?? '',
        avatarUrl: profile?.avatarUrl ?? m.avatarUrl ?? null,
        languages: (m.langs ?? []) as TeacherRosterRow['languages'],
        role: 'TEACHER',
        status: mapRosterStatus(m.status),
        maxWeeklyHours: m.maxWeeklyHours ?? 20,
        joinedAt: m.joinedAt ?? '',
      };
    });
  } catch {
    return [];
  }
});

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
