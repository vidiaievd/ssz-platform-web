'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useCourseHome, ErrorState, LearningSkeleton } from '@/features/learning';

import { CourseHeader } from './course-header';
import { ContinueHero, deriveContinueScenario } from './continue-hero';
import { ViewToggle, type CourseView } from './view-toggle';
import { UnitFlowList } from './unit-flow-list';
import { SkillIndex } from './skill-index';

export interface CourseHomePageProps {
  courseId: string;
  locale: string;
}

export function CourseHomePage({ courseId, locale }: CourseHomePageProps) {
  const t = useTranslations('Learning.courseHome');
  const [activeView, setActiveView] = useState<CourseView>('units');
  const { data, isLoading, isError, refetch } = useCourseHome(courseId);

  if (isLoading) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div
          className="mb-4 h-24 w-full animate-pulse rounded-[18px]"
          style={{ background: 'var(--ssz-bg-surface)' }}
          aria-hidden="true"
        />
        <div
          className="mb-8 h-46 w-full animate-pulse rounded-2xl"
          style={{ background: 'var(--ssz-bg-subtle)' }}
          aria-hidden="true"
        />
        <LearningSkeleton variant="text" rows={8} />
      </main>
    );
  }

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

  const { courseInfo, units, progress, mastery, srsDueCount, overdueAssignmentCount } = data;

  const scenario = deriveContinueScenario({
    overdueAssignmentCount,
    srsDueCount,
    modules: progress.modules,
  });

  const ctaHref = buildCtaHref({ scenario, courseId, locale, modules: progress.modules });
  const courseHref = `/${locale}/student/courses/${courseId}`;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <CourseHeader courseInfo={courseInfo} progress={progress} />

      {/* Continue hero */}
      <div className="mt-4">
        <ContinueHero scenario={scenario} ctaHref={ctaHref} srsDueCount={srsDueCount} />
      </div>

      {/* View toggle + content */}
      <div className="mt-8">
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

      {/* F3.3 sidebar cards (ReviewCard + CanDoCard) — next step */}
    </main>
  );
}

/* ── Build the CTA href from scenario ───────────────────────────── */

function buildCtaHref(opts: {
  scenario: string;
  courseId: string;
  locale: string;
  modules: { moduleId: string; status: string }[];
}): string {
  const { scenario, courseId, locale, modules } = opts;
  const base = `/${locale}/student`;

  if (scenario === 'overdue') {
    return `${base}/assignments`;
  }
  if (scenario === 'review') {
    return `${base}/srs`;
  }
  if (scenario === 'resume') {
    const activeModule = modules.find((m) => m.status === 'in_progress');
    if (activeModule) {
      return `${base}/units/${activeModule.moduleId}?courseId=${courseId}`;
    }
  }
  if (scenario === 'start') {
    const nextModule = modules.find((m) => m.status === 'not_started');
    if (nextModule) {
      return `${base}/units/${nextModule.moduleId}?courseId=${courseId}`;
    }
  }
  // caught-up: link to the last locked unit for preview (or back to courses)
  const lockedModule = [...modules].reverse().find((m) => m.status === 'not_started');
  if (lockedModule) {
    return `${base}/units/${lockedModule.moduleId}?courseId=${courseId}`;
  }
  return `${base}/courses`;
}
