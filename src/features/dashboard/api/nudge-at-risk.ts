'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

type NudgeResult =
  | { success: true; nudged: number }
  | { success: false; error: string };

export async function nudgeAtRiskStudents(schoolSlug: string, schoolId: string): Promise<NudgeResult> {
  try {
    const data = await serverFetch<{ nudged: number }>({
      service: 'analytics',
      path: `/schools/${schoolId}/dashboard/nudge`,
      method: 'POST',
      body: { scope: 'all-at-risk' },
    });

    revalidatePath(`/school/${schoolSlug}/dashboard`);

    return { success: true, nudged: data.nudged };
  } catch (e) {
    if (e instanceof AppError && e.code === 'forbidden') {
      return { success: false, error: 'forbidden' };
    }
    return { success: false, error: 'unknown' };
  }
}
