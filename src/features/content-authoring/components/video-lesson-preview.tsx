'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useMediaAsset } from '@/features/media';
import type { LessonVideoCue } from '@/features/content/types';

import { findVideoSource } from '../lib/lesson-media-tokens';

interface VideoLessonPreviewProps {
  title: string;
  body: string;
  cues: LessonVideoCue[];
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

/** Live "exactly what the learner sees" preview for a VIDEO lesson, rendered inside `PhoneFrame`. */
export function VideoLessonPreview({ title, body, cues }: VideoLessonPreviewProps) {
  const t = useTranslations('Authoring');
  const source = findVideoSource(body);
  const { data: asset } = useMediaAsset(source?.mediaId);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const sortedCues = [...cues].sort((a, b) => a.startSeconds - b.startSeconds);
  const activeCue = findActiveCue(sortedCues, currentTime);

  return (
    <div>
      <div className="border-b border-(--ssz-border-default) bg-surface px-4 pb-3 pt-4">
        <div className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
          {title || t('lessons.untitled')}
        </div>
      </div>

      {asset?.url ? (
        <div className="relative bg-black">
          <video
            ref={videoRef}
            src={asset.url}
            controls
            className="w-full"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          />
          {activeCue && (
            <div className="pointer-events-none absolute inset-x-0 bottom-12 flex flex-col items-center gap-0.5 px-4 text-center">
              <span className="rounded bg-black/75 px-2 py-1 text-sm font-medium text-white">
                {activeCue.targetLine}
              </span>
              {activeCue.translationLine && (
                <span className="rounded bg-black/60 px-2 py-0.5 text-xs text-white/85">
                  {activeCue.translationLine}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-3.5">
          <p className="italic text-muted-foreground">{t('lessons.previewEmpty')}</p>
        </div>
      )}

      {sortedCues.length > 0 && (
        <div className="px-4 py-3.5 font-reading text-[14.5px] leading-loose text-(--ssz-text-primary)">
          {sortedCues.map((cue) => (
            <p
              key={cue.position}
              className={cue === activeCue ? 'mb-2 font-semibold text-primary' : 'mb-2 text-muted-foreground'}
            >
              {cue.targetLine}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
