import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { Container, ContainerItem } from '@/features/content/types';
import type {
  CanDoResponse,
  CourseMastery,
  CourseHomePayload,
  CourseInfo,
  CourseProgress,
  LessonProgressStatus,
  SrsDueResponse,
  UnitStatus,
  UnitSummary,
} from '@/features/learning/types';

function mapUnitStatus(s: LessonProgressStatus): UnitStatus {
  if (s === 'completed') return 'done';
  if (s === 'in_progress') return 'active';
  return 'locked';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;

  try {
    /* ── Phase 1: parallel upstream calls ─────────────────────────── */
    const [progress, mastery, srsDue, canDo, container] = await Promise.all([
      serverFetch<CourseProgress>({
        service: 'progress',
        path: `/learning/progress/courses/${courseId}`,
      }),
      serverFetch<CourseMastery>({
        service: 'progress',
        path: `/learning/mastery/courses/${courseId}`,
      }),
      serverFetch<SrsDueResponse>({
        service: 'progress',
        path: '/srs/due',
      }),
      serverFetch<CanDoResponse>({
        service: 'progress',
        path: `/can-do?courseId=${encodeURIComponent(courseId)}`,
      }),
      serverFetch<Container>({
        service: 'content',
        path: `/containers/${courseId}`,
      }),
    ]);

    /* ── Phase 2: module list (needs versionId from container) ─────── */
    let units: UnitSummary[] = [];
    const versionId = container.currentPublishedVersionId;
    if (versionId) {
      try {
        const items = await serverFetch<ContainerItem[]>({
          service: 'content',
          path: `/containers/${courseId}/versions/${versionId}/items`,
        });
        const progressByModule = new Map(
          progress.modules.map((m) => [m.moduleId, m]),
        );
        units = items
          .filter((item) => item.itemType === 'container')
          .sort((a, b) => a.position - b.position)
          .map((item) => {
            const mp = progressByModule.get(item.itemId);
            return {
              id: item.itemId,
              position: item.position,
              title: item.title ?? `Unit ${item.position}`,
              status: mapUnitStatus(mp?.status ?? 'not_started'),
              completedLessons: mp?.completedLessons ?? 0,
              totalLessons: mp?.totalLessons ?? 0,
            };
          });
      } catch {
        // Non-fatal: units defaults to empty array
      }
    }

    const courseInfo: CourseInfo = {
      id: container.id,
      title: container.title,
      cefrLevel: container.difficultyLevel,
      targetLanguage: container.targetLanguage,
    };

    const payload: CourseHomePayload = {
      courseInfo,
      units,
      progress,
      mastery,
      srsDueCount: srsDue.dueCount,
      srsStreakDays: srsDue.streakDays,
      canDo,
      overdueAssignmentCount: 0,
    };

    return NextResponse.json(payload);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load course home' }, { status: 502 });
  }
}
