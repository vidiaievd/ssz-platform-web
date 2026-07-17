'use client';

import { useTranslations } from 'next-intl';

import { useMediaAsset } from '@/features/media';
import { AudioPlayer } from '@/features/learning';
import type { LessonListeningStage } from '@/features/content/types';

import { findAudioNarration } from '@/lib/content/lesson-media-tokens';

interface AudioLessonPreviewProps {
  title: string;
  body: string;
  transcript: string;
  stages: LessonListeningStage[];
}

/** Live "exactly what the learner sees" preview for an AUDIO lesson, rendered inside `PhoneFrame`. */
export function AudioLessonPreview({ title, body, transcript, stages }: AudioLessonPreviewProps) {
  const t = useTranslations('Authoring');
  const source = findAudioNarration(body);
  const { data: asset } = useMediaAsset(source?.mediaId);

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);

  return (
    <div>
      <div className="border-b border-(--ssz-border-default) bg-surface px-4 pb-3 pt-4">
        <div className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
          {title || t('lessons.untitled')}
        </div>
      </div>

      <div className="px-4 py-3.5">
        {asset?.url ? (
          <AudioPlayer src={asset.url} label={title || t('lessons.untitled')} />
        ) : (
          <p className="italic text-muted-foreground">{t('lessons.previewEmpty')}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3.5 text-xs font-medium text-muted-foreground">
        <span className="rounded-full border border-border px-2.5 py-1">
          {t('editor.previewStageListen')}
        </span>
        {sortedStages.map((stage) => (
          <span key={stage.position} className="flex items-center gap-1.5">
            <span aria-hidden>→</span>
            <span className="rounded-full border border-border px-2.5 py-1">
              {t(stage.stageType === 'gap_fill' ? 'editor.stageTypeGapFill' : 'editor.stageTypeComprehension')}
            </span>
          </span>
        ))}
      </div>

      {transcript && (
        <div className="border-t border-(--ssz-border-default) px-4 py-3.5 font-reading text-[14.5px] leading-loose text-(--ssz-text-primary)">
          {transcript}
        </div>
      )}
    </div>
  );
}
