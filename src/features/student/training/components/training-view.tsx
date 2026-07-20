'use client';

import { PenLine, Repeat, Shuffle, Target, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useReviewsSummary } from '@/features/learning/api/use-reviews-summary';
import { ErrorState } from '@/features/learning/components/error-state';
import { LearningSkeleton } from '@/features/learning/components/learning-skeleton';
import type { ReviewKind } from '@/features/learning/types';
import { HSection, TrainingTile, type TrainingTileData } from '@/features/student/home/components';
import { useRouter } from '@/lib/i18n/navigation';
import { RecommendationBanner } from './recommendation-banner';

const TYPE_ICON: Record<ReviewKind, typeof PenLine> = {
  exercise: PenLine,
  vocabulary_word: Type,
};

const TYPE_HUE: Record<ReviewKind, number> = {
  exercise: 15,
  vocabulary_word: 145,
};

function MethodNote() {
  const t = useTranslations('Student.trainingPage');

  return (
    <div className="mt-7 flex items-start gap-3 rounded-md bg-(--ssz-bg-subtle) px-4.5 py-4">
      <Repeat size={18} className="mt-0.5 shrink-0 text-(--ssz-text-secondary)" aria-hidden="true" />
      <p className="text-[13px] leading-relaxed text-(--ssz-text-secondary)">{t('methodNote')}</p>
    </div>
  );
}

/**
 * Training hub, reduced to what real data can back: two featured entry points
 * (review what's due / a mixed session) plus practice tiles by SRS content
 * type. The handoff's six skill tiles need a skill dimension exercises don't
 * have yet — see docs/plan/13-student-home-redesign.md, Step 9.
 */
export function TrainingView() {
  const t = useTranslations('Student.trainingPage');
  const router = useRouter();
  const { data, isLoading, error, refetch } = useReviewsSummary();

  if (isLoading) {
    return (
      <div className="space-y-5">
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

  const totalReady = data.totalDue;
  const goToSrs = () => router.push('/student/srs');

  const recommendedKind: ReviewKind | null =
    totalReady === 0 ? null : data.byKind.vocabulary_word > data.byKind.exercise ? 'vocabulary_word' : 'exercise';

  const featuredTiles: TrainingTileData[] = [
    {
      id: 'review',
      icon: Repeat,
      hue: 168,
      label: t('featured.reviewLabel'),
      description: t('featured.reviewDescription'),
      meta: t('featured.reviewMeta', { count: totalReady }),
      disabled: totalReady === 0,
    },
    {
      id: 'mixed',
      icon: Shuffle,
      hue: 235,
      label: t('featured.mixedLabel'),
      description: t('featured.mixedDescription'),
      disabled: totalReady === 0,
    },
  ];

  const typeTiles: TrainingTileData[] = (['exercise', 'vocabulary_word'] as const).map((kind) => ({
    id: kind,
    icon: TYPE_ICON[kind],
    hue: TYPE_HUE[kind],
    label: t(`byType.${kind}.label`),
    description: t(`byType.${kind}.description`),
    ready: data.byKind[kind],
    disabled: data.byKind[kind] === 0,
  }));

  return (
    <div>
      {recommendedKind && (
        <RecommendationBanner
          kind={recommendedKind}
          count={data.byKind[recommendedKind]}
          icon={TYPE_ICON[recommendedKind]}
          hue={TYPE_HUE[recommendedKind]}
          onStart={goToSrs}
        />
      )}

      <div className="mb-8 grid gap-3.5 sm:grid-cols-2">
        {featuredTiles.map((tile) => (
          <TrainingTile key={tile.id} tile={tile} size="lg" onOpen={goToSrs} />
        ))}
      </div>

      <HSection icon={Target} title={t('byType.title')} sub={t('byType.subtitle')} />
      <div className="grid gap-3.5 sm:grid-cols-2">
        {typeTiles.map((tile) => (
          <TrainingTile key={tile.id} tile={tile} onOpen={goToSrs} />
        ))}
      </div>

      <MethodNote />
    </div>
  );
}
