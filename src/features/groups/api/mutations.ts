'use server';

import { revalidateTag } from 'next/cache';

// This Next.js version requires a profile as the second arg.
function invalidate(tag: string) {
  revalidateTag(tag, {});
}

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import type { MutationResult, SessionScore, Slot } from '@/features/groups/types';
import type {
  NewSessionInput,
  RegenerateReport,
  SessionChanges,
} from '@/lib/scheduling/provider';
import { groupCacheTags } from './keys';

// ── Helpers ───────────────────────────────────────────────────────────────────

type FailResult = Extract<MutationResult, { ok: false }>;

// organization-service's GroupMode enum uses an underscore ('online' | 'in_person');
// the frontend's GroupMode type uses a hyphen ('online' | 'in-person').
function toBackendMode(mode: string): 'online' | 'in_person' {
  return mode === 'in-person' ? 'in_person' : 'online';
}

// The UI represents "no capacity limit" as 0 (see queries.ts `capacityMin ?? 0`),
// but organization-service models it as null and validates any set value with
// @Min(1). Translate the 0 sentinel to null so an unset limit isn't rejected.
function toBackendCapacity(value?: number | null): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value < 1) return null;
  return value;
}

// organization-service requires a school UUID; callers pass either the slug
// (from the URL) or the UUID, so resolve here before forwarding upstream.
async function requireSchoolId(idOrSlug: string): Promise<string> {
  const schoolId = await resolveSchoolId(idOrSlug);
  if (!schoolId) throw new AppError('not_found', 'School not found');
  return schoolId;
}

function mapError(e: unknown): MutationResult {
  if (e instanceof AppError && e.code === 'conflict') {
    const details = e.details as
      | { conflicts?: FailResult['conflicts']; blocked?: FailResult['blocked'] }
      | undefined;
    const result: FailResult = { ok: false };
    if (details?.conflicts) result.conflicts = details.conflicts;
    if (details?.blocked) result.blocked = details.blocked;
    return result;
  }
  if (e instanceof AppError && e.code === 'validation') {
    return { ok: false };
  }
  if (e instanceof AppError && e.code === 'not_found') {
    return { ok: false };
  }
  throw e; // unexpected — let Next.js handle it
}

// ── Group CRUD ────────────────────────────────────────────────────────────────

export async function createGroup(
  schoolId: string,
  data: { name: string; courseId?: string | null; lang: string; level: string; mode: string; capacityMin: number; capacityMax: number; startDate?: string; endDate?: string; ageBand?: string | null },
): Promise<MutationResult & { id?: string }> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    const result = await serverFetch<{ id: string }>({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups`,
      method: 'POST',
      body: {
        ...data,
        mode: toBackendMode(data.mode),
        capacityMin: toBackendCapacity(data.capacityMin),
        capacityMax: toBackendCapacity(data.capacityMax),
      },
    });
    invalidate(groupCacheTags.groups(schoolId));
    return { ok: true, id: result.id };
  } catch (e) {
    return mapError(e);
  }
}

export async function updateGroup(
  schoolId: string,
  groupId: string,
  data: Partial<{ name: string; courseId: string | null; lang: string; level: string; mode: string; capacityMin: number; capacityMax: number; startDate: string | null; endDate: string | null; ageBand: string | null }>,
): Promise<MutationResult> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    await serverFetch({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups/${groupId}`,
      method: 'PATCH',
      body: {
        ...data,
        mode: data.mode !== undefined ? toBackendMode(data.mode) : undefined,
        capacityMin: 'capacityMin' in data ? toBackendCapacity(data.capacityMin) : undefined,
        capacityMax: 'capacityMax' in data ? toBackendCapacity(data.capacityMax) : undefined,
      },
    });
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

export async function deleteGroup(schoolId: string, groupId: string): Promise<MutationResult> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    await serverFetch({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups/${groupId}`,
      method: 'DELETE',
    });
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    invalidate(groupCacheTags.conflicts(schoolId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

export async function publishGroup(schoolId: string, groupId: string): Promise<MutationResult> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    await serverFetch({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups/${groupId}/publish`,
      method: 'POST',
    });
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

export async function duplicateGroup(
  schoolId: string,
  groupId: string,
): Promise<MutationResult & { id?: string }> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    const result = await serverFetch<{ id: string }>({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups/${groupId}/duplicate`,
      method: 'POST',
    });
    invalidate(groupCacheTags.groups(schoolId));
    return { ok: true, id: result.id };
  } catch (e) {
    return mapError(e);
  }
}

export async function archiveGroup(schoolId: string, groupId: string): Promise<MutationResult> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    await serverFetch({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups/${groupId}/archive`,
      method: 'POST',
    });
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    invalidate(groupCacheTags.conflicts(schoolId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Teacher assignment ────────────────────────────────────────────────────────

export async function assignTeacher(
  schoolId: string,
  groupId: string,
  data: { userId: string; role: 'primary' | 'co-primary' | 'substitute'; from?: string; to?: string; reason?: string },
  override = false,
): Promise<MutationResult> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    await serverFetch({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups/${groupId}/teachers`,
      method: 'POST',
      query: override ? { override: true } : undefined,
      body: {
        userId: data.userId,
        role: data.role === 'co-primary' ? 'co_primary' : data.role,
        fromDate: data.from,
        toDate: data.to,
        reason: data.reason,
      },
    });
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    invalidate(groupCacheTags.conflicts(schoolId));
    invalidate(groupCacheTags.teachers(schoolId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

export async function removeTeacher(
  schoolId: string,
  groupId: string,
  userId: string,
): Promise<MutationResult> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    await serverFetch({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups/${groupId}/teachers/${userId}`,
      method: 'DELETE',
    });
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    invalidate(groupCacheTags.conflicts(schoolId));
    invalidate(groupCacheTags.teachers(schoolId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Additional materials ───────────────────────────────────────────────────────
// Distinct from the group's main material (courseId, via updateGroup) — these
// are freely added/removed, with no "can't be cleared" restriction.

export async function addGroupMaterial(
  schoolId: string,
  groupId: string,
  courseId: string,
): Promise<MutationResult & { id?: string }> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    const result = await serverFetch<{ id: string }>({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups/${groupId}/materials`,
      method: 'POST',
      body: { courseId },
    });
    invalidate(groupCacheTags.group(groupId));
    return { ok: true, id: result.id };
  } catch (e) {
    return mapError(e);
  }
}

export async function removeGroupMaterial(
  schoolId: string,
  groupId: string,
  materialId: string,
): Promise<MutationResult> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    await serverFetch({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups/${groupId}/materials/${materialId}`,
      method: 'DELETE',
    });
    invalidate(groupCacheTags.group(groupId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Roster (student members) ──────────────────────────────────────────────────

export async function addStudents(
  schoolId: string,
  groupId: string,
  userIds: string[],
  override = false,
): Promise<MutationResult> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    for (const userId of userIds) {
      await serverFetch({
        service: 'organization',
        path: `/schools/${resolvedSchoolId}/groups/${groupId}/members`,
        method: 'POST',
        query: override ? { override: true } : undefined,
        body: { userId },
      });
    }
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

/**
 * Stitch a unit of the teaching plan to a unit of the linked course, so the
 * course's own units can show how much of each has been taught. Passing null
 * unstitches — a plan unit that teaches nothing in this course is a legitimate
 * state, not an error.
 */
export async function linkPlanUnit(
  schoolId: string,
  groupId: string,
  planUnitId: string,
  contentUnitId: string | null,
): Promise<MutationResult> {
  try {
    const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
    const result = await getSchedulingProvider().linkPlanUnit(planUnitId, contentUnitId);
    if (!result.ok) return result;
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

/**
 * Record that a lesson happened and which unit of the plan it taught. This is
 * the only way group progress moves: the scheduler counts held lessons, and a
 * date that has passed says nothing on its own.
 */
export async function markLessonHeld(
  schoolId: string,
  groupId: string,
  lessonId: string,
  curriculumUnitId: string,
): Promise<MutationResult> {
  try {
    const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
    const result = await getSchedulingProvider().markLessonHeld(lessonId, curriculumUnitId);
    if (!result.ok) return result;
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Sessions (schedule & log) ─────────────────────────────────────────────────

/**
 * All session writes share the same two invalidations: the group's own page and
 * the school's group list, whose progress column reads the same facts.
 */
function invalidateSessions(schoolId: string, groupId: string): void {
  invalidate(groupCacheTags.group(groupId));
  invalidate(groupCacheTags.groups(schoolId));
}

export async function patchSession(
  schoolId: string,
  groupId: string,
  sessionId: string,
  changes: SessionChanges,
): Promise<MutationResult> {
  const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
  const result = await getSchedulingProvider().patchSession(sessionId, changes);
  if (!result.ok) return result;
  invalidateSessions(schoolId, groupId);
  return { ok: true };
}

export async function createSession(
  schoolId: string,
  groupId: string,
  input: NewSessionInput,
): Promise<MutationResult> {
  const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
  const result = await getSchedulingProvider().createSession(schoolId, groupId, input);
  if (!result.ok) return result;
  invalidateSessions(schoolId, groupId);
  return { ok: true };
}

export async function deleteSession(
  schoolId: string,
  groupId: string,
  sessionId: string,
): Promise<MutationResult> {
  const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
  const result = await getSchedulingProvider().deleteSession(sessionId);
  if (!result.ok) return result;
  invalidateSessions(schoolId, groupId);
  return { ok: true };
}

export async function putSessionScores(
  schoolId: string,
  groupId: string,
  sessionId: string,
  scores: SessionScore[],
): Promise<MutationResult> {
  const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
  const result = await getSchedulingProvider().putSessionScores(sessionId, scores);
  if (!result.ok) return result;
  invalidateSessions(schoolId, groupId);
  return { ok: true };
}

/**
 * Its own return shape rather than the groups' MutationResult: a rebuild has
 * something to say even when it succeeds — how much it planned, how much it left
 * alone, and why it planned nothing when it planned nothing.
 */
export async function regenerateSessions(
  schoolId: string,
  groupId: string,
): Promise<{ ok: true; report: RegenerateReport } | { ok: false; error: string }> {
  const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
  const result = await getSchedulingProvider().regenerateSessions(schoolId, groupId);
  if (!result.ok) return { ok: false, error: result.error };
  invalidateSessions(schoolId, groupId);
  return { ok: true, report: result.data ?? { planned: 0, kept: 0, reason: null } };
}

export async function removeStudent(
  schoolId: string,
  groupId: string,
  userId: string,
): Promise<MutationResult> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    await serverFetch({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups/${groupId}/members/${userId}`,
      method: 'DELETE',
    });
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Slots (scheduling provider) ───────────────────────────────────────────────

export async function updateSlots(
  schoolId: string,
  groupId: string,
  slots: Slot[],
): Promise<MutationResult> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
    const scheduling = getSchedulingProvider();
    await scheduling.putSlots(resolvedSchoolId, groupId, slots);
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.conflicts(schoolId));
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError && e.code === 'upstream_unavailable') {
      // Scheduling service not yet available; slots will need to be set later.
      return { ok: true };
    }
    return mapError(e);
  }
}
