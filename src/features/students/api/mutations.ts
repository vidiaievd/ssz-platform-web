'use server';

import { revalidateTag } from 'next/cache';

function invalidate(tag: string) {
  revalidateTag(tag, {});
}

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';
import type { MutationResult } from '@/features/groups/types';
import type { EmailResolveResult } from '@/features/students/types';
import { studentCacheTags } from './keys';
import { groupCacheTags } from '@/features/groups/api/keys';

// ── Helpers ───────────────────────────────────────────────────────────────────

type FailResult = Extract<MutationResult, { ok: false }>;

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
  throw e;
}

// ── Enroll (3-branch) ─────────────────────────────────────────────────────────

type EnrollInput = {
  email: string;
  targetGroupId?: string;
  branch: EmailResolveResult['branch'];
  userId?: string;
};

export async function enrollStudent(
  schoolId: string,
  input: EnrollInput,
): Promise<MutationResult & { invited?: boolean }> {
  try {
    if (input.branch === 'attach-direct' && input.userId) {
      // Ensure user is a STUDENT member of the school
      await serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/members`,
        method: 'POST',
        body: { userId: input.userId, role: 'STUDENT' },
      }).catch(() => {
        // May already be a member — ignore 409
      });

      // Add to group if specified
      if (input.targetGroupId) {
        await serverFetch({
          service: 'organization',
          path: `/schools/${schoolId}/groups/${input.targetGroupId}/members`,
          method: 'POST',
          body: { userIds: [input.userId] },
        });
        invalidate(groupCacheTags.group(input.targetGroupId));
        invalidate(groupCacheTags.groups(schoolId));
      }
    } else {
      const kind =
        input.branch === 'onboard-existing' ? 'onboard-existing' : 'register';
      await serverFetch({
        service: 'organization',
        path: `/schools/${schoolId}/invitations`,
        method: 'POST',
        body: {
          email: input.email,
          role: 'STUDENT',
          targetGroupId: input.targetGroupId,
          kind,
        },
      });
    }

    invalidate(studentCacheTags.students(schoolId));
    if (input.userId) invalidate(studentCacheTags.student(input.userId));

    return { ok: true, invited: input.branch !== 'attach-direct' };
  } catch (e) {
    return mapError(e);
  }
}

export async function enrollStudents(
  schoolId: string,
  inputs: EnrollInput[],
): Promise<{
  ok: boolean;
  invited: number;
  attached: number;
  failed: number;
}> {
  let invited = 0;
  let attached = 0;
  let failed = 0;

  await Promise.allSettled(
    inputs.map(async (input) => {
      const result = await enrollStudent(schoolId, input);
      if (result.ok) {
        if ((result as { invited?: boolean }).invited) invited++;
        else attached++;
      } else {
        failed++;
      }
    }),
  );

  return { ok: failed === 0, invited, attached, failed };
}

// ── Add to group ──────────────────────────────────────────────────────────────

export async function addToGroup(
  schoolId: string,
  groupId: string,
  userId: string,
  override = false,
): Promise<MutationResult> {
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/groups/${groupId}/members`,
      method: 'POST',
      query: override ? { override: 'true' } : undefined,
      body: { userIds: [userId] },
    });
    invalidate(studentCacheTags.students(schoolId));
    invalidate(studentCacheTags.student(userId));
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    invalidate(`conflicts:${schoolId}`);
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Remove from group ─────────────────────────────────────────────────────────

export async function removeFromGroup(
  schoolId: string,
  groupId: string,
  userId: string,
): Promise<MutationResult> {
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/groups/${groupId}/members/${userId}`,
      method: 'DELETE',
    });
    invalidate(studentCacheTags.students(schoolId));
    invalidate(studentCacheTags.student(userId));
    invalidate(groupCacheTags.group(groupId));
    invalidate(groupCacheTags.groups(schoolId));
    invalidate(`conflicts:${schoolId}`);
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Nudge ─────────────────────────────────────────────────────────────────────

export async function nudgeStudent(
  schoolId: string,
  userId: string,
): Promise<MutationResult> {
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/students/${userId}/nudge`,
      method: 'POST',
    });
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Bulk message (feature-flagged) ────────────────────────────────────────────

export async function bulkMessage(
  schoolId: string,
  data: { subject: string; body: string; userIds: string[] },
): Promise<MutationResult> {
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/students/message`,
      method: 'POST',
      body: data,
    });
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Transfer group ────────────────────────────────────────────────────────────

export async function transferGroup(
  schoolId: string,
  studentId: string,
  fromGroupId: string,
  toGroupId: string,
  role?: string,
): Promise<MutationResult> {
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/students/${studentId}/transfer`,
      method: 'POST',
      body: { fromGroupId, toGroupId, ...(role && { role }) },
    });
    invalidate(studentCacheTags.students(schoolId));
    invalidate(studentCacheTags.student(studentId));
    invalidate(groupCacheTags.group(fromGroupId));
    invalidate(groupCacheTags.group(toGroupId));
    invalidate(groupCacheTags.groups(schoolId));
    invalidate(`conflicts:${schoolId}`);
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Change membership role ────────────────────────────────────────────────────

export async function updateMembershipRole(
  schoolId: string,
  groupId: string,
  membershipId: string,
  role: string,
): Promise<MutationResult> {
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/groups/${groupId}/members/${membershipId}`,
      method: 'PATCH',
      body: { role },
    });
    invalidate(studentCacheTags.student(membershipId));
    invalidate(groupCacheTags.group(groupId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Archive / unarchive student ───────────────────────────────────────────────

export async function archiveStudent(
  schoolId: string,
  studentId: string,
  archive: boolean,
): Promise<MutationResult> {
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/students/${studentId}`,
      method: 'PATCH',
      body: { status: archive ? 'archived' : 'active' },
    });
    invalidate(studentCacheTags.students(schoolId));
    invalidate(studentCacheTags.student(studentId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Remove from school ────────────────────────────────────────────────────────

export async function removeFromSchool(
  schoolId: string,
  studentId: string,
): Promise<MutationResult> {
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/students/${studentId}`,
      method: 'DELETE',
    });
    invalidate(studentCacheTags.students(schoolId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Change level ──────────────────────────────────────────────────────────────

export async function changeStudentLevel(
  schoolId: string,
  studentId: string,
  level: string,
): Promise<MutationResult> {
  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/students/${studentId}`,
      method: 'PATCH',
      body: { level },
    });
    invalidate(studentCacheTags.students(schoolId));
    invalidate(studentCacheTags.student(studentId));
    return { ok: true };
  } catch (e) {
    return mapError(e);
  }
}

// ── Save segment (feature-flagged) ────────────────────────────────────────────

export async function saveSegment(
  schoolId: string,
  data: { name: string; predicate: Record<string, unknown> },
): Promise<MutationResult & { id?: string }> {
  try {
    const result = await serverFetch<{ id: string }>({
      service: 'organization',
      path: `/schools/${schoolId}/students/segments`,
      method: 'POST',
      body: data,
    });
    invalidate(studentCacheTags.segments(schoolId));
    return { ok: true, id: result.id };
  } catch (e) {
    return mapError(e);
  }
}
