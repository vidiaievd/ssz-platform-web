'use client';

import { CircleCheck, Layers, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/features/learning/components/empty-state';
import { ErrorState } from '@/features/learning/components/error-state';
import { LearningSkeleton } from '@/features/learning/components/learning-skeleton';
import { useReviewsSummary } from '@/features/learning/api/use-reviews-summary';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { ComingUpCard } from './coming-up-card';
import { DueNowCard } from './due-now-card';

/** Explains why the count moves day to day — the method note from the handoff. */
function MethodNote() {
  const t = useTranslations('Student.reviewsPage');

  return (
    <div className="flex items-start gap-3 rounded-md bg-(--ssz-bg-subtle) px-4.5 py-4">
      <Target size={18} className="mt-0.5 shrink-0 text-(--ssz-text-secondary)" aria-hidden="true" />
      <p className="text-[13px] leading-relaxed text-(--ssz-text-secondary)">{t('methodNote')}</p>
    </div>
  );
}

function MixedSessionCard() {
  const t = useTranslations('Student.reviewsPage.mixed');

  return (
    <div className="rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface p-4.5 shadow-(--ssz-shadow-xs)">
      <div className="mb-1 text-[13.5px] font-bold text-(--ssz-text-primary)">{t('title')}</div>
      <p className="mb-3 text-[12.5px] leading-relaxed text-(--ssz-text-secondary)">
        {t('description')}
      </p>
      <Button asChild size="sm" variant="outline">
        <Link href="/student/training">
          <Layers size={15} aria-hidden="true" />
          {t('cta')}
        </Link>
      </Button>
    </div>
  );
}

/** Reviews & reminders: what is due now, and what the schedule holds next. */
export function ReviewsView() {
  const t = useTranslations('Student.reviewsPage');
  const router = useRouter();
  const { data, isLoading, error, refetch } = useReviewsSummary();

  if (isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <LearningSkeleton variant="card" />
        <LearningSkeleton variant="card" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  // An empty queue is a finished job, not a failure — and not a nudge to grind.
  if (data.totalDue === 0) {
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface">
            <EmptyState
              icon={CircleCheck}
              title={t('empty.title')}
              description={t('empty.description')}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/student/my-courses">{t('empty.cta')}</Link>
                </Button>
              }
            />
          </div>
          <MethodNote />
        </div>
        <div className="space-y-4">
          <ComingUpCard upcoming={data.upcoming} />
          <MixedSessionCard />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <DueNowCard summary={data} onReviewAll={() => router.push('/student/srs')} />
        <MethodNote />
      </div>
      <div className="space-y-4">
        <ComingUpCard upcoming={data.upcoming} />
        <MixedSessionCard />
      </div>
    </div>
  );
}
