'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useMediaAsset } from '@/features/media';
import { GlossaryParagraph, VideoPlayer, type GlossaryIndex } from '@/features/learning';
import type { LessonVideoCue } from '@/features/content/types';

import { findVideoSource } from '@/lib/content/lesson-media-tokens';

interface VideoLessonPreviewProps {
  title: string;
  body: string;
  cues: LessonVideoCue[];
  glossary: GlossaryIndex;
  targetLang?: string;
}

/** Finds the last cue whose startSeconds has passed, i.e. the one currently playing. */
function findActiveCue(cues: LessonVideoCue[], currentTime: number): LessonVideoCue | null {
  let active: LessonVideoCue | null = null;
  for (const cue of cues) {
    if (cue.startSeconds <= currentTime) {
      if (!active || cue.startSeconds > active.startSeconds) active = cue;
    }
  }
  return active;
}

/**
 * Live "exactly what the learner sees" preview for a VIDEO lesson, rendered
 * inside `PhoneFrame`. Shares `VideoPlayer` and the glossary popover with the
 * reader (FE6.1) instead of a plain native `<video>`.
 */
export function VideoLessonPreview({ title, body, cues, glossary, targetLang }: VideoLessonPreviewProps) {
  const t = useTranslations('Authoring');
  const source = findVideoSource(body);
  const { data: asset } = useMediaAsset(source?.mediaId);
  const [currentTime, setCurrentTime] = useState(0);

  const sortedCues = [...cues].sort((a, b) => a.startSeconds - b.startSeconds);
  const activeCue = findActiveCue(sortedCues, currentTime);

  return (
    <div>
      <div className="border-b border-(--ssz-border-default) bg-surface px-4 pb-3 pt-4">
        <div className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
          {title || t('lessons.untitled')}
        </div>
      </div>

      <VideoPlayer
        src={asset?.url}
        label={title || t('lessons.untitled')}
        cues={sortedCues}
        glossary={glossary}
        targetLang={targetLang ?? ''}
        showSubtitles
        onTimeUpdate={setCurrentTime}
      />

      {sortedCues.length > 0 && (
        <div className="px-4 py-3.5 font-reading text-[14.5px] leading-loose text-(--ssz-text-primary)">
          {sortedCues.map((cue) => (
            <div key={cue.position} className="mb-2">
              <GlossaryParagraph
                text={cue.targetLine}
                glossary={glossary}
                lang={targetLang}
                className={cue === activeCue ? 'font-semibold text-primary' : 'text-muted-foreground'}
              />
              {cue === activeCue && cue.translationLine && (
                <p className="text-xs text-muted-foreground italic">{cue.translationLine}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
