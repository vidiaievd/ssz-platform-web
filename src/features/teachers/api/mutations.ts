'use server';

import { revalidateTag } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

function invalidate(tag: string) {
  revalidateTag(tag, {});
}

import type {
  AvailabilityBlock,
  Absence,
  CurriculumPlan,
  CurriculumUnit,
  ForecastScenario,
  ForecastParams,
} from '@/features/teachers/types';
import type { MutationResult } from '@/features/groups/types';

// ── Roster ────────────────────────────────────────────────────────────────────

export type InviteBranch =
  | { branch: 'added'; name: string }
  | { branch: 'register' | 'onboard'; email: string };

export type AddTeacherResult =
  | { success: true; data: InviteBranch }
  | { success: false; error: 'conflict' | 'generic' };

export async function addTeacher(
  schoolId: string,
  input: {
    email: string;
    maxWeeklyContactHours: number;
    employmentType: 'full' | 'part' | 'contract';
    teachingLanguages: { code: string; level: string }[];
  },
): Promise<AddTeacherResult> {
  try {
    // 1. Look up user by email
    let user: { userId?: string; displayName?: string; roles?: string[] } | null = null;
    try {
      user = await serverFetch<{ userId?: string; displayName?: string; roles?: string[] }>({
        service: 'organization',
        path: '/users/lookup',
        query: { email: input.email, schoolId },
      });
    } catch (e) {
      if (!(e instanceof AppError && e.code === 'not_found')) throw e;
    }

    const hasTeacherRole = user?.roles?.some((r) => r === 'TEACHER' || r === 'teacher');

    if (user?.userId && hasTeacherRole) {
      // Branch 2: already a teacher — add directly as school member
      await serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/members`,
        method: 'POST',
        body: { userId: user.userId, role: 'TEACHER' },
      }).catch(() => {
        // 409 = already a member, ignore
      });
      invalidate(`school-${schoolId}-teachers`);
      return { success: true, data: { branch: 'added', name: user.displayName ?? input.email } };
    }

    // Branches 1 & 3: send invitation
    const kind = user?.userId ? 'onboard' : 'register';
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/invitations`,
      method: 'POST',
      body: {
        email: input.email,
        role: 'TEACHER',
        kind,
        maxWeeklyHours: input.maxWeeklyContactHours,
        employmentType: input.employmentType,
        teachingLanguages: input.teachingLanguages,
      },
    });
    invalidate(`school-${schoolId}-teachers`);
    return { success: true, data: { branch: kind, email: input.email } };
  } catch (e) {
    if (e instanceof AppError && e.code === 'conflict') {
      return { success: false, error: 'conflict' };
    }
    return { success: false, error: 'generic' };
  }
}

export type RemoveTeacherResult =
  | { ok: true }
  | { ok: false; blocked: 'primary-teacher'; groupCount: number };

export async function removeTeacher(
  schoolId: string,
  teacherId: string,
): Promise<RemoveTeacherResult> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/teachers/${teacherId}`,
    { method: 'DELETE', cache: 'no-store' },
  );
  if (res.status === 409) {
    const body = (await res.json()) as { groupCount?: number };
    return { ok: false, blocked: 'primary-teacher', groupCount: body.groupCount ?? 1 };
  }
  if (!res.ok) return { ok: false, blocked: 'primary-teacher', groupCount: 0 };
  invalidate(`school-${schoolId}-teachers`);
  return { ok: true };
}

// ── Availability ──────────────────────────────────────────────────────────────

export async function updateAvailability(
  schoolId: string,
  teacherId: string,
  blocks: AvailabilityBlock[],
): Promise<MutationResult> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/teachers/${teacherId}/availability`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blocks),
      cache: 'no-store',
    },
  );
  const data = (await res.json()) as MutationResult;
  if (data.ok) {
    invalidate(`teacher-${teacherId}-availability`);
    invalidate(`school-${schoolId}-teachers`);
  }
  return data;
}

// ── Absence ───────────────────────────────────────────────────────────────────

export async function reportAbsence(
  schoolId: string,
  input: Pick<Absence, 'teacherId' | 'kind' | 'scope' | 'from' | 'to' | 'reason'>,
): Promise<MutationResult & { absenceId?: string }> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/teachers/${input.teacherId}/absences`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  const data = (await res.json()) as MutationResult & { absenceId?: string };
  if (data.ok) {
    invalidate(`school-${schoolId}-absences`);
    invalidate(`school-${schoolId}-substitutions`);
  }
  return data;
}

// ── Substitution ──────────────────────────────────────────────────────────────

export async function assignSubstitute(
  schoolId: string,
  requestId: string,
  substituteTeacherId: string,
  override?: boolean,
): Promise<MutationResult> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/scheduling/substitutions/${requestId}/assign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ substituteTeacherId, override }),
      cache: 'no-store',
    },
  );
  const data = (await res.json()) as MutationResult;
  if (data.ok) invalidate(`school-${schoolId}-substitutions`);
  return data;
}

export async function arrangeCover(
  schoolId: string,
  lessonId: string,
): Promise<MutationResult> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/scheduling/substitutions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId }),
      cache: 'no-store',
    },
  );
  const data = (await res.json()) as MutationResult;
  if (data.ok) invalidate(`school-${schoolId}-substitutions`);
  return data;
}

export async function bulkCover(
  schoolId: string,
  requestIds: string[],
): Promise<{ covered: number; flagged: number }> {
  const results = await Promise.all(
    requestIds.map(async (requestId) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/scheduling/substitutions/${requestId}/candidates`,
        { cache: 'no-store' },
      );
      const candidates = (await res.json()) as Array<{ eligible: boolean; teacherId: string }>;
      const best = candidates.find((c) => c.eligible);
      if (!best) return false;

      const assignRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/scheduling/substitutions/${requestId}/assign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ substituteTeacherId: best.teacherId }),
          cache: 'no-store',
        },
      );
      const result = (await assignRes.json()) as MutationResult;
      return result.ok;
    }),
  );
  const covered = results.filter(Boolean).length;
  invalidate(`school-${schoolId}-substitutions`);
  return { covered, flagged: requestIds.length - covered };
}

// ── Curriculum ────────────────────────────────────────────────────────────────

export async function updateUnit(
  schoolId: string,
  groupId: string,
  unit: CurriculumUnit,
): Promise<MutationResult> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/curriculum/${groupId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit }),
      cache: 'no-store',
    },
  );
  const data = (await res.json()) as MutationResult;
  if (data.ok) invalidate(`curriculum-${groupId}`);
  return data;
}

export async function reorderUnits(
  schoolId: string,
  groupId: string,
  orderedUnitIds: string[],
): Promise<MutationResult> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/curriculum/${groupId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorder: orderedUnitIds }),
      cache: 'no-store',
    },
  );
  const data = (await res.json()) as MutationResult;
  if (data.ok) invalidate(`curriculum-${groupId}`);
  return data;
}

export async function applyOverride(
  schoolId: string,
  groupId: string,
  unitId: string,
  reason: string,
  plan: CurriculumPlan,
): Promise<MutationResult> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/curriculum/${groupId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ override: { unitId, reason }, plan }),
      cache: 'no-store',
    },
  );
  const data = (await res.json()) as MutationResult;
  if (data.ok) invalidate(`curriculum-${groupId}`);
  return data;
}

// ── Forecast ──────────────────────────────────────────────────────────────────

export async function saveScenario(
  schoolId: string,
  name: string,
  params: ForecastParams,
): Promise<MutationResult & { scenario?: ForecastScenario }> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/scheduling/forecast`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, params }),
      cache: 'no-store',
    },
  );
  const data = (await res.json()) as MutationResult & { scenario?: ForecastScenario };
  if (data.ok) invalidate(`school-${schoolId}-forecast`);
  return data;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export async function ackAlert(
  schoolId: string,
  alertId: string,
): Promise<MutationResult> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/schools/${schoolId}/scheduling/alerts/${alertId}/ack`,
    { method: 'POST', cache: 'no-store' },
  );
  const data = (await res.json()) as MutationResult;
  if (data.ok) invalidate(`school-${schoolId}-alerts`);
  return data;
}
