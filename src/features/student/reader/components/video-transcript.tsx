'use client';

import { useTranslations } from 'next-intl';

import { GlossaryParagraph, type GlossaryIndex } from '@/features/learning';
import type { LessonVideoCue } from '@/features/content/types';
import { cn } from '@/lib/utils';

import { formatTimecode } from '../lib/format-timecode';

export interface VideoTranscriptProps {
  cues: LessonVideoCue[];
  currentTime: number;
  glossary: GlossaryIndex;
  targetLang: string;
  showTranslation: boolean;
  onJump: (seconds: number) => void;
}

/** Last cue whose startSeconds has passed, i.e. the one currently playing. */
function findActiveIndex(cues: LessonVideoCue[], currentTime: number): number {
  let activeIndex = -1;
  cues.forEach((cue, i) => {
    if (cue.startSeconds <= currentTime) activeIndex = i;
  });
  return activeIndex;
}

/** Synced transcript for a VIDEO lesson (BE1.2) — click a line to seek and play. */
export function VideoTranscript({
  cues,
  currentTime,
  glossary,
  targetLang,
  showTranslation,
  onJump,
}: VideoTranscriptProps) {
  const t = useTranslations('Learning.reader.video.transcript');
  const activeIndex = findActiveIndex(cues, currentTime);

  if (cues.length === 0) {
    return <p className="text-sm text-(--ssz-text-muted) italic">{t('empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {cues.map((cue, i) => {
        const active = i === activeIndex;
        const past = i < activeIndex;
        return (
          <div
            key={cue.position}
            role="button"
            tabIndex={0}
            onClick={() => onJump(cue.startSeconds)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onJump(cue.startSeconds);
              }
            }}
            className={cn(
              'flex cursor-pointer gap-3 rounded-[10px] border-l-[2.5px] border-transparent px-3 py-2.5 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
              active
                ? 'border-(--ssz-color-primary-500) bg-(--ssz-color-primary-50)'
                : 'hover:bg-(--ssz-bg-subtle)',
              past && !active && 'opacity-60',
            )}
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            <span className="mt-1 min-w-8 shrink-0 font-mono text-[11px] text-(--ssz-text-muted)">
              {formatTimecode(cue.startSeconds)}
            </span>
            <div className="min-w-0 flex-1">
              <GlossaryParagraph
                text={cue.targetLine}
                glossary={glossary}
                lang={targetLang}
                className={cn(
                  'text-[15.5px] leading-relaxed',
                  active ? 'font-semibold text-(--ssz-color-primary-700)' : 'text-(--ssz-text-primary)',
                )}
              />
              {showTranslation && cue.translationLine && (
                <p className="mt-0.75 text-[12.5px] leading-relaxed text-(--ssz-text-muted) italic">
                  {cue.translationLine}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
