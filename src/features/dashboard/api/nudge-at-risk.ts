'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { wsHref } from '@/features/workspaces/lib/href';

type NudgeResult =
  | { success: true; nudged: number }
  | { success: false; error: string };

export async function nudgeAtRiskStudents(workspaceId: string, schoolId: string): Promise<NudgeResult> {
  try {
    const data = await serverFetch<{ nudged: number }>({
      service: 'analytics',
      path: `/analytics/schools/${schoolId}/nudge`,
      method: 'POST',
      body: { scope: 'all-at-risk' },
    });

    revalidatePath(wsHref(workspaceId, 'dashboard'));

    return { success: true, nudged: data.nudged };
  } catch (e) {
    if (e instanceof AppError && e.code === 'forbidden') {
      return { success: false, error: 'forbidden' };
    }
    return { success: false, error: 'unknown' };
  }
}
