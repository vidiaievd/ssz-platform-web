'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { ErrorState, LearningSkeleton } from '@/features/learning';
import {
  useBestLessonVariant,
  useExercisesWithAnswers,
  useIntroduceCard,
  useLesson,
  useLessonListeningStages,
} from '@/features/content';
import { useMyStudentProfile } from '@/features/profile';
import { useMediaAsset } from '@/features/media';
import { findAudioNarration } from '@/lib/content/lesson-media-tokens';

import { ListeningStageTracker, type ListeningStage } from './listening-stage-tracker';
import { ListeningListenStage } from './listening-listen-stage';
import { ListeningGapFillStage } from './listening-gapfill-stage';
import { ListeningCompStage } from './listening-comp-stage';
import { ListeningDoneStage } from './listening-done-stage';
import {
  parseComprehensionExercise,
  parseGapFillExercise,
  type ListeningComprehensionItem,
  type ListeningGapFillItem,
} from '../lib/parse-listening-exercise';

export interface ListeningLessonPageProps {
  lessonId: string;
  unitPosition: number;
  courseTitle: string;
  cefrLevel: string;
  /** Per-item XP reward (`UnitContentsItem.xpReward`), shown on the done stage. */
  xpReward?: number | null;
}

export function ListeningLessonPage({
  lessonId,
  unitPosition,
  courseTitle,
  cefrLevel,
  xpReward,
}: ListeningLessonPageProps) {
  const t = useTranslations('Learning.reader.listening.page');
  const tContent = useTranslations('Content');
  const [stage, setStage] = useState<ListeningStage>('listen');
  const [missedExerciseIds, setMissedExerciseIds] = useState<string[]>([]);

  const lesson = useLesson(lessonId);
  const profile = useMyStudentProfile();
  const nativeLanguage = profile.data?.nativeLanguage ?? undefined;
  const profileReady = !profile.isLoading && !!nativeLanguage;

  const variant = useBestLessonVariant(lessonId, nativeLanguage ?? '', cefrLevel, profileReady);
  const stagesQuery = useLessonListeningStages(lessonId, variant.data?.id);

  const gapFillStages = useMemo(
    () => (stagesQuery.data ?? []).filter((s) => s.stageType === 'gap_fill').sort((a, b) => a.position - b.position),
    [stagesQuery.data],
  );
  const compStages = useMemo(
    () =>
      (stagesQuery.data ?? []).filter((s) => s.stageType === 'comprehension').sort((a, b) => a.position - b.position),
    [stagesQuery.data],
  );

  const gapFillExercises = useExercisesWithAnswers(gapFillStages.map((s) => s.exerciseId));
  const compExercises = useExercisesWithAnswers(compStages.map((s) => s.exerciseId));

  const gapFillItems: ListeningGapFillItem[] = useMemo(
    () =>
      gapFillStages
        .map((s, i) => {
          const display = gapFillExercises[i]?.data;
          return display ? parseGapFillExercise(s, display) : null;
        })
        .filter((item): item is ListeningGapFillItem => item !== null),
    [gapFillStages, gapFillExercises],
  );
  const compItems: ListeningComprehensionItem[] = useMemo(
    () =>
      compStages
        .map((s, i) => {
          const display = compExercises[i]?.data;
          return display ? parseComprehensionExercise(s, display) : null;
        })
        .filter((item): item is ListeningComprehensionItem => item !== null),
    [compStages, compExercises],
  );

  const narration = useMemo(() => findAudioNarration(variant.data?.bodyMarkdown ?? ''), [variant.data?.bodyMarkdown]);
  const audioAsset = useMediaAsset(narration?.mediaId);

  const introduceCard = useIntroduceCard();
  useEffect(() => {
    if (stage !== 'done' || missedExerciseIds.length === 0) return;
    missedExerciseIds.forEach((exerciseId) => {
      introduceCard.mutate({ contentType: 'EXERCISE', contentId: exerciseId });
    });
    // Fire once per arrival at `done` — introduceCard/missedExerciseIds are stable for that transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const isLoading =
    lesson.isLoading ||
    profile.isLoading ||
    (profileReady && variant.isLoading) ||
    (profileReady && !!variant.data && stagesQuery.isLoading);
  const isError = lesson.isError || profile.isError || (profileReady && variant.isError) || stagesQuery.isError;

  if (isLoading) {
    return <LearningSkeleton variant="card" rows={4} />;
  }

  if (isError || !lesson.data) {
    return (
      <ErrorState
        onRetry={() => {
          lesson.refetch();
          profile.refetch();
          if (profileReady) variant.refetch();
          stagesQuery.refetch();
        }}
      />
    );
  }

  if (!profileReady || !variant.data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-2xl border border-(--ssz-border-default) bg-surface px-6 py-16 text-center">
        <p className="text-lg font-medium text-(--ssz-text-primary)">{t('emptyTitle')}</p>
        <p className="text-sm text-(--ssz-text-muted)">{t('emptyBody')}</p>
      </div>
    );
  }

  if (gapFillItems.length === 0 && compItems.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-2xl border border-(--ssz-border-default) bg-surface px-6 py-16 text-center">
        <p className="text-lg font-medium text-(--ssz-text-primary)">{t('noStagesTitle')}</p>
        <p className="text-sm text-(--ssz-text-muted)">{t('noStagesBody')}</p>
      </div>
    );
  }

  const audioLabel = variant.data.displayTitle || lesson.data.title;

  return (
    <div>
      <div className="mb-4.5">
        <div className="mb-1.5 text-[11px] font-bold tracking-wider text-(--ssz-color-primary-600) uppercase">
          {t('eyebrow', { unit: unitPosition, course: courseTitle, type: tContent('materialType.audio') })}
        </div>
        <h1 className="font-reading mb-1.5 text-[29px] leading-[1.15] font-semibold tracking-tight text-(--ssz-text-primary)">
          {audioLabel}
        </h1>
      </div>

      <ListeningStageTracker stage={stage} />

      {stage === 'listen' && (
        <ListeningListenStage
          audioSrc={audioAsset.data?.url}
          audioLabel={audioLabel}
          onNext={() => setStage(gapFillItems.length > 0 ? 'gapfill' : 'comp')}
        />
      )}
      {stage === 'gapfill' && gapFillItems.length > 0 && (
        <ListeningGapFillStage
          items={gapFillItems}
          audioSrc={audioAsset.data?.url}
          audioLabel={audioLabel}
          onNext={(missed) => {
            setMissedExerciseIds((prev) => [...prev, ...missed]);
            setStage(compItems.length > 0 ? 'comp' : 'done');
          }}
        />
      )}
      {stage === 'comp' && compItems.length > 0 && (
        <ListeningCompStage
          items={compItems}
          audioSrc={audioAsset.data?.url}
          audioLabel={audioLabel}
          onDone={(missed) => {
            setMissedExerciseIds((prev) => [...prev, ...missed]);
            setStage('done');
          }}
        />
      )}
      {stage === 'done' && <ListeningDoneStage xpReward={xpReward} />}
    </div>
  );
}
