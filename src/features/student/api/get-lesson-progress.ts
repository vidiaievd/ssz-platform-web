import 'server-only';

import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { LessonProgressRecord, LessonProgressStatus } from '../types/learning';

const STATUS_MAP: Record<string, LessonProgressStatus> = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  NEEDS_REVIEW: 'needs_review',
};

const ProgressItem = z.object({
  contentRef: z.object({ type: z.string(), id: z.string() }),
  status: z.string(),
  score: z.number().nullable().optional(),
  completedAt: z.string().nullable().optional(),
});

const ProgressList = z.array(ProgressItem);

/**
 * Fetches the current student's progress on every LESSON content item in one call
 * and returns it keyed by lessonId. Learning Service has no per-container aggregate
 * endpoint — progress is one row per (user, contentType, contentId).
 */
export async function getLessonProgressMap(): Promise<Map<string, LessonProgressRecord>> {
  try {
    const raw = await serverFetch({
      service: 'progress',
      path: '/progress',
      query: { contentType: 'LESSON' },
    });

    const parsed = ProgressList.safeParse(raw);
    if (!parsed.success) return new Map();

    return new Map(
      parsed.data.map((item) => [
        item.contentRef.id,
        {
          lessonId: item.contentRef.id,
          status: STATUS_MAP[item.status] ?? 'not_started',
          score: item.score ?? null,
          completedAt: item.completedAt ?? null,
        },
      ]),
    );
  } catch {
    return new Map();
  }
}
