import 'server-only';

import { z } from 'zod';

import type { Container } from '@/features/content/types';
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';
import type { StudentHistoryItem } from '../types/learning';

const RawEnrollment = z.object({
  containerId: z.string().optional(),
  status: z.string(),
  completedAt: z.string().nullish(),
});

/**
 * Finished enrolments for the «History» section of "My courses" (plan 90, live check, Q15).
 * A purged school's enrolments end `COMPLETED` and its course stays readable as history
 * (Q11) — unless it is a `shared` course of someone else, which answers 403 / 404: that row
 * is kept with `course: null` so the learner is told it is gone instead of it vanishing.
 * Any other failure drops the row (as `getMyCourses` does for a course it cannot describe).
 */
export async function getMyHistory(): Promise<StudentHistoryItem[]> {
  const raw = await serverFetch({ service: 'enrollment', path: '/enrollments' }).catch(() => null);
  const done = (z.array(RawEnrollment).safeParse(raw).data ?? [])
    .filter((e) => e.status.toUpperCase() === 'COMPLETED' && e.containerId)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  const rows = await Promise.all(
    done.map(async (e): Promise<StudentHistoryItem | null> => {
      const completedAt = e.completedAt ?? null;
      try {
        const c = await serverFetch<Container>({
          service: 'content',
          path: `/containers/${e.containerId}`,
          expectedErrorStatuses: [403, 404],
        });
        return {
          containerId: e.containerId!,
          completedAt,
          course: { title: c.title, level: c.difficultyLevel ?? null, targetLanguage: c.targetLanguage },
        };
      } catch (err) {
        if (err instanceof AppError && (err.code === 'forbidden' || err.code === 'not_found')) {
          return { containerId: e.containerId!, completedAt, course: null };
        }
        return null;
      }
    }),
  );
  return rows.filter((r): r is StudentHistoryItem => r !== null);
}
