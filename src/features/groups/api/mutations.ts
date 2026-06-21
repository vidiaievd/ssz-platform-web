'use server';

import { revalidateTag } from 'next/cache';

// This Next.js version requires a profile as the second arg.
function invalidate(tag: string) {
  revalidateTag(tag, {});
}

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import type { MutationResult, Slot } from '@/features/groups/types';
import { groupCacheTags } from './keys';

// ── Helpers ───────────────────────────────────────────────────────────────────

type FailResult = Extract<MutationResult, { ok: false }>;

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
  data: { name: string; courseId?: string | null; lang: string; level: string; mode: string; minCapacity: number; maxCapacity: number },
): Promise<MutationResult & { id?: string }> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    const result = await serverFetch<{ id: string }>({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups`,
      method: 'POST',
      body: data,
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
  data: Partial<{ name: string; courseId: string | null; lang: string; level: string; mode: string; minCapacity: number; maxCapacity: number; startDate: string | null; endDate: string | null }>,
): Promise<MutationResult> {
  try {
    const resolvedSchoolId = await requireSchoolId(schoolId);
    await serverFetch({
      service: 'organization',
      path: `/schools/${resolvedSchoolId}/groups/${groupId}`,
      method: 'PATCH',
      body: data,
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
    const { getSchedulingProvider } = await import('@/lib/scheduling/provider');
    const scheduling = getSchedulingProvider();
    await scheduling.putSlots(groupId, slots);
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
