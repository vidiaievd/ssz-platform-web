import { type NextRequest, NextResponse } from 'next/server';

import type {
  CanDoResponse,
  CourseMastery,
  CourseProgress,
  ProgressCanDo,
  ProgressCanDoState,
  ProgressModule,
  ProgressModuleStatus,
  ProgressOverview,
  ProgressSkillId,
  ProgressSkillMastery,
  ProgressSrsStats,
  ProgressStudentInfo,
  SrsStats,
} from '@/features/learning/types';
import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';

/* ── Helpers ─────────────────────────────────────────────────────── */

function mapCanDoState(backendState: string): ProgressCanDoState {
  if (backendState === 'unlocked') return 'completed';
  if (backendState === 'mastered') return 'mastered';
  if (backendState === 'in-progress') return 'in-progress';
  return 'in-progress';
}

function mapModuleStatus(backendStatus: string): ProgressModuleStatus {
  switch (backendStatus) {
    case 'mastered':   return 'mastered';
    case 'completed':  return 'completed';
    case 'in_progress':
    case 'active':     return 'active';
    default:           return 'locked';
  }
}

const SKILL_ID_MAP: Record<string, ProgressSkillId> = {
  reading:   'reading',
  listening: 'listening',
  vocabulary:'vocab',
  vocab:     'vocab',
  grammar:   'grammar',
};

const SKILL_LABEL: Record<ProgressSkillId, string> = {
  reading:   'Reading',
  listening: 'Listening',
  vocab:     'Vocabulary',
  grammar:   'Grammar',
};

/* ── Route ───────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const courseId = request.nextUrl.searchParams.get('courseId') ?? undefined;

  try {
    /* ── Parallel upstream fetch ────────────────────────────────── */
    const [srsStats, canDoRaw] = await Promise.all([
      // `/srs/stats/me` — plain `/srs/stats` is a 404 — and it already carries
      // both the due backlog and today's count, so the due queue itself is not
      // needed here.
      serverFetch<SrsStats>({ service: 'progress', path: '/srs/stats/me' }),
      serverFetch<CanDoResponse>({
        service: 'progress',
        path: '/learning/can-do',
        query: courseId ? { courseId } : undefined,
      }),
    ]);

    /* ── Course-specific calls (conditional) ──────────────────── */
    let masteryRaw: CourseMastery | null = null;
    let progressRaw: CourseProgress | null = null;

    if (courseId) {
      [masteryRaw, progressRaw] = await Promise.all([
        serverFetch<CourseMastery>({
          service: 'progress',
          path: `/learning/mastery/courses/${courseId}`,
        }),
        serverFetch<CourseProgress>({
          service: 'progress',
          path: `/learning/progress/courses/${courseId}`,
        }),
      ]);
    }

    /* ── Map SRS stats ──────────────────────────────────────────── */
    const srs: ProgressSrsStats = {
      dueToday:      srsStats.dueNowCount,
      reviewedToday: srsStats.reviewedTodayCount,
      totalCards:
        srsStats.newCount +
        srsStats.learningCount +
        srsStats.reviewCount +
        srsStats.relearningCount +
        srsStats.suspendedCount,
      cardsInReview: srsStats.reviewCount,
    };

    /* ── Map can-dos ────────────────────────────────────────────── */
    const canDos: ProgressCanDo[] = canDoRaw.items.map((item) => ({
      id:     item.id,
      text:   item.descriptor,
      skill:  item.cefrLevel ?? '',
      module: item.moduleId,
      date:   item.unlockedAt
        ? new Date(item.unlockedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : null,
      state:  mapCanDoState(item.state),
      pct:    item.state === 'in-progress'
        ? Math.round((item.evidenceCount / Math.max(item.evidenceCount + 1, 3)) * 100)
        : undefined,
    }));

    /* ── Map skill mastery ──────────────────────────────────────── */
    const mastery: ProgressSkillMastery[] = masteryRaw
      ? masteryRaw.bySkill.flatMap((s) => {
          const id = SKILL_ID_MAP[s.skill.toLowerCase()];
          if (!id) return [];
          const mastered = Math.round(s.masteryPercent);
          // completed is derived: successes / total attempts, capped at 100.
          const attempt = s.attemptCount > 0 ? s.attemptCount : 1;
          const completed = Math.min(100, Math.round((s.successCount / attempt) * 100));
          return [{ id, label: SKILL_LABEL[id], completed, mastered, level: masteryRaw!.overallMastery > 0 ? 'A1→A2' : 'A1' }];
        })
      : [];

    /* ── Map modules ────────────────────────────────────────────── */
    const modules: ProgressModule[] = progressRaw
      ? progressRaw.modules.map((m) => {
          const pct = m.totalLessons > 0
            ? Math.round((m.completedLessons / m.totalLessons) * 100)
            : 0;
          return {
            id:        m.moduleId,
            title:     m.moduleId,   // title resolved from content-service when available
            completed: pct,
            mastered:  0,            // requires SRS per-module data (plan 23 extension)
            candos:    0,
            status:    mapModuleStatus(m.status),
          };
        })
      : [];

    /* ── Student info stub ──────────────────────────────────────── */
    const student: ProgressStudentInfo = {
      id:         '',
      name:       '',
      courseName: '',
      startedAt:  '',
    };

    const payload: ProgressOverview = { student, canDos, mastery, srs, modules };

    return NextResponse.json(payload);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch progress overview' }, { status: 502 });
  }
}
