'use client';

import { useMemo, useRef, useState } from 'react';
import { BookOpen, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  ErrorState,
  LearningSkeleton,
  VideoPlayer,
  buildGlossaryIndex,
  type VideoPlayerHandle,
} from '@/features/learning';
import {
  useLesson,
  useBestLessonVariant,
  useLessonVideoCues,
  useLessonGlossaryMarks,
  useUnitVocabularyItems,
} from '@/features/content';
import { useMyStudentProfile } from '@/features/profile';
import { useMediaAsset } from '@/features/media';
import { findVideoSource } from '@/lib/content/lesson-media-tokens';
import { cn } from '@/lib/utils';

import { VideoTranscript } from './video-transcript';
import { VideoNotesPanel } from './video-notes-panel';

export interface VideoLessonPageProps {
  lessonId: string;
  /** The unit module's vocabulary list — glossary marks resolve against its items. Undefined if the unit has none. */
  vocabularyListId?: string;
  unitPosition: number;
  courseTitle: string;
  cefrLevel: string;
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BookOpen;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border-[1.5px] px-3.5 py-1.5 text-xs font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
        active
          ? 'border-(--ssz-color-primary-500) bg-(--ssz-color-primary-50) text-(--ssz-color-primary-600)'
          : 'border-(--ssz-border-default) text-(--ssz-text-secondary)',
      )}
      style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
    >
      <Icon size={13} aria-hidden="true" />
      {children}
    </button>
  );
}

export function VideoLessonPage({
  lessonId,
  vocabularyListId,
  unitPosition,
  courseTitle,
  cefrLevel,
}: VideoLessonPageProps) {
  const t = useTranslations('Learning.reader.video.page');
  const tTranscript = useTranslations('Learning.reader.video.transcript');
  const tContent = useTranslations('Content');
  const playerRef = useRef<VideoPlayerHandle>(null);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const lesson = useLesson(lessonId);
  const profile = useMyStudentProfile();
  const nativeLanguage = profile.data?.nativeLanguage ?? undefined;
  const profileReady = !profile.isLoading && !!nativeLanguage;

  const variant = useBestLessonVariant(lessonId, nativeLanguage ?? '', cefrLevel, profileReady);
  const cuesQuery = useLessonVideoCues(lessonId, variant.data?.id);
  const marksQuery = useLessonGlossaryMarks(lessonId, variant.data?.id);
  const vocabItems = useUnitVocabularyItems(vocabularyListId ?? '', !!vocabularyListId);

  const videoSource = useMemo(() => findVideoSource(variant.data?.bodyMarkdown ?? ''), [variant.data?.bodyMarkdown]);
  const videoAsset = useMediaAsset(videoSource?.mediaId);

  const glossary = useMemo(() => {
    const markedIds = new Set((marksQuery.data ?? []).map((m) => m.vocabularyItemId));
    return buildGlossaryIndex((vocabItems.data ?? []).filter((item) => markedIds.has(item.id)));
  }, [marksQuery.data, vocabItems.data]);

  const sortedCues = useMemo(
    () => [...(cuesQuery.data ?? [])].sort((a, b) => a.startSeconds - b.startSeconds),
    [cuesQuery.data],
  );

  const isLoading = lesson.isLoading || profile.isLoading || (profileReady && variant.isLoading);
  const isError = lesson.isError || profile.isError || (profileReady && variant.isError);

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

  return (
    <div>
      <div className="mb-4.5">
        <div className="mb-1.5 text-[11px] font-bold tracking-wider text-(--ssz-color-primary-600) uppercase">
          {t('eyebrow', { unit: unitPosition, course: courseTitle, type: tContent('materialType.video') })}
        </div>
        <h1 className="font-reading mb-1.5 text-[29px] leading-[1.15] font-semibold tracking-tight text-(--ssz-text-primary)">
          {variant.data.displayTitle || lesson.data.title}
        </h1>
        {variant.data.displayDescription && (
          <p className="text-sm text-(--ssz-text-muted) italic">{variant.data.displayDescription}</p>
        )}
      </div>

      <VideoPlayer
        ref={playerRef}
        src={videoAsset.data?.url}
        label={variant.data.displayTitle || lesson.data.title}
        cues={sortedCues}
        glossary={glossary}
        targetLang={lesson.data.targetLanguage}
        showSubtitles={showSubtitles}
        onTimeUpdate={setCurrentTime}
      />

      <div className="my-4 flex flex-wrap items-center gap-2.5">
        <ToggleButton active={showSubtitles} onClick={() => setShowSubtitles((v) => !v)} icon={BookOpen}>
          {showSubtitles ? t('subtitlesOn') : t('subtitlesOff')}
        </ToggleButton>
        <ToggleButton active={showTranslation} onClick={() => setShowTranslation((v) => !v)} icon={Eye}>
          {showTranslation ? t('translationOn') : t('translationOff')}
        </ToggleButton>
        {glossary.size > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-(--ssz-text-muted)">
            <span
              className="inline-block w-6.5 border-b-[1.5px] border-dotted border-(--ssz-color-primary-500) align-middle"
              aria-hidden="true"
            />
            {t('tapSubtitleWords')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-5.5 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-2.5 flex items-center gap-1.75 text-[13px] font-bold text-(--ssz-text-primary)">
            <BookOpen size={15} className="text-(--ssz-color-primary-700)" aria-hidden="true" />
            {tTranscript('heading')}
            <span className="text-[11px] font-medium text-(--ssz-text-muted)">
              · {tTranscript('clickToJump')}
            </span>
          </div>
          <VideoTranscript
            cues={sortedCues}
            currentTime={currentTime}
            glossary={glossary}
            targetLang={lesson.data.targetLanguage}
            showTranslation={showTranslation}
            onJump={(seconds) => playerRef.current?.seekTo(seconds)}
          />
        </div>
        <div className="lg:sticky lg:top-2">
          <VideoNotesPanel lessonId={lessonId} currentTime={currentTime} />
        </div>
      </div>
    </div>
  );
}
