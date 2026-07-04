'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useCourseHome, ErrorState, LearningSkeleton } from '@/features/learning';

import { CourseHeader } from './course-header';
import { ContinueHero, deriveContinueScenario } from './continue-hero';
import { ViewToggle, type CourseView } from './view-toggle';
import { UnitFlowList } from './unit-flow-list';
import { SkillIndex } from './skill-index';
import { ReviewCard } from './review-card';
import { CanDoCard } from './can-do-card';

export interface CourseHomePageProps {
  courseId: string;
  locale: string;
}

export function CourseHomePage({ courseId, locale }: CourseHomePageProps) {
  const t = useTranslations('Learning.courseHome');
  const [activeView, setActiveView] = useState<CourseView>('units');
  const { data, isLoading, isError, refetch } = useCourseHome(courseId);

  /* ── Loading skeleton ────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div
          className="mb-4 h-24 w-full animate-pulse rounded-[18px]"
          style={{ background: 'var(--ssz-bg-surface)' }}
          aria-hidden="true"
        />
        <div className="flex gap-6">
          <div className="min-w-0 flex-1 space-y-4">
            <div
              className="h-46 w-full animate-pulse rounded-2xl"
              style={{ background: 'var(--ssz-bg-subtle)' }}
              aria-hidden="true"
            />
            <LearningSkeleton variant="text" rows={8} />
          </div>
          <div className="hidden w-[280px] shrink-0 space-y-4 lg:block">
            <div
              className="h-48 w-full animate-pulse rounded-2xl"
              style={{ background: 'var(--ssz-bg-surface)' }}
              aria-hidden="true"
            />
            <div
              className="h-64 w-full animate-pulse rounded-2xl"
              style={{ background: 'var(--ssz-bg-surface)' }}
              aria-hidden="true"
            />
          </div>
        </div>
      </main>
    );
  }

  /* ── Error state ─────────────────────────────────────────────────── */
  if (isError || !data) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <ErrorState
          title={t('loadError')}
          description={t('loadErrorSub')}
          onRetry={() => void refetch()}
        />
      </main>
    );
  }

  const {
    courseInfo,
    units,
    progress,
    mastery,
    canDo,
    srsDueCount,
    srsReviewedToday,
    srsVocabDue,
    srsExerciseDue,
    overdueAssignmentCount,
  } = data;

  const scenario = deriveContinueScenario({
    overdueAssignmentCount,
    srsDueCount,
    modules: progress.modules,
  });

  const ctaHref = buildCtaHref({ scenario, courseId, locale, modules: progress.modules });
  const courseHref = `/${locale}/student/courses/${courseId}`;
  const reviewHref = `/${locale}/student/srs`;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      {/* Full-width header */}
      <CourseHeader courseInfo={courseInfo} progress={progress} />

      {/* Two-column layout: main (flex-1) + sidebar (280px on lg+) */}
      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start">

        {/* ── Left / main column ────────────────────────────────── */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* Continue hero */}
          <ContinueHero scenario={scenario} ctaHref={ctaHref} srsDueCount={srsDueCount} />

          {/* View toggle + unit/skill content */}
          <div>
            <div className="mb-4">
              <ViewToggle value={activeView} onChange={setActiveView} />
            </div>

            {activeView === 'units' ? (
              <div
                className="rounded-2xl border"
                style={{
                  borderColor: 'var(--ssz-border-default)',
                  background: 'var(--ssz-bg-surface)',
                  boxShadow: 'var(--ssz-shadow-xs)',
                }}
              >
                <div className="px-5">
                  <UnitFlowList units={units} courseId={courseId} locale={locale} />
                </div>
              </div>
            ) : (
              <SkillIndex skills={mastery.bySkill} courseHref={courseHref} />
            )}
          </div>

          {/* Sidebar cards on mobile/tablet (below main content) */}
          <div className="space-y-4 lg:hidden">
            <ReviewCard
              dueCount={srsDueCount}
              reviewedToday={srsReviewedToday}
              vocabDue={srsVocabDue}
              exerciseDue={srsExerciseDue}
              reviewHref={reviewHref}
            />
            <CanDoCard items={canDo.items} units={units} />
          </div>
        </div>

        {/* ── Right / sidebar column (lg+) ──────────────────────── */}
        <aside className="hidden w-[280px] shrink-0 space-y-4 lg:block" aria-label="Course sidebar">
          <ReviewCard
            dueCount={srsDueCount}
            reviewedToday={srsReviewedToday}
            vocabDue={srsVocabDue}
            exerciseDue={srsExerciseDue}
            reviewHref={reviewHref}
          />
          <CanDoCard items={canDo.items} units={units} />
        </aside>
      </div>
    </main>
  );
}

/* ── Build CTA href from scenario ────────────────────────────────── */

function buildCtaHref(opts: {
  scenario: string;
  courseId: string;
  locale: string;
  modules: { moduleId: string; status: string }[];
}): string {
  const { scenario, courseId, locale, modules } = opts;
  const base = `/${locale}/student`;

  if (scenario === 'overdue') return `${base}/assignments`;
  if (scenario === 'review') return `${base}/srs`;

  if (scenario === 'resume') {
    const active = modules.find((m) => m.status === 'in_progress');
    if (active) return `${base}/units/${active.moduleId}?courseId=${courseId}`;
  }
  if (scenario === 'start') {
    const next = modules.find((m) => m.status === 'not_started');
    if (next) return `${base}/units/${next.moduleId}?courseId=${courseId}`;
  }
  const lastLocked = [...modules].reverse().find((m) => m.status === 'not_started');
  if (lastLocked) return `${base}/units/${lastLocked.moduleId}?courseId=${courseId}`;
  return `${base}/courses`;
}
