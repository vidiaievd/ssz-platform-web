import 'server-only';

import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const EnrollmentItem = z.object({
  id: z.string(),
  containerId: z.string().optional(),
  schoolId: z.string().optional(),
  status: z.string(),
});

const EnrollmentList = z.object({
  items: z.array(EnrollmentItem).default([]),
});

/**
 * Returns active enrollment IDs for the current user.
 * Used by the enrolled-section layout to gate access.
 */
export async function getEnrollmentStatus(): Promise<string[]> {
  try {
    const raw = await serverFetch({
      service: 'enrollment',
      path: '/api/v1/enrollments',
    });

    const parsed = EnrollmentList.safeParse(raw);
    if (!parsed.success) return [];

    return parsed.data.items
      .filter((e) => e.status === 'approved' || e.status === 'active')
      .map((e) => e.containerId ?? e.schoolId ?? e.id);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') return [];
    return [];
  }
}
