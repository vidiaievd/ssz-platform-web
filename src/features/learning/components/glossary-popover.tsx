'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { AudioPlayer } from '@/features/learning/components/audio-player';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type PartOfSpeech = 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'conj' | 'other';

const POS_STYLES: Record<PartOfSpeech, { bg: string; fg: string }> = {
  noun:  { bg: 'oklch(0.93 0.05 235)', fg: 'oklch(0.44 0.10 235)' },
  verb:  { bg: 'oklch(0.93 0.05 145)', fg: 'oklch(0.40 0.12 145)' },
  adj:   { bg: 'oklch(0.93 0.05 75)',  fg: 'oklch(0.50 0.10 75)'  },
  adv:   { bg: 'oklch(0.93 0.05 280)', fg: 'oklch(0.44 0.10 280)' },
  prep:  { bg: 'oklch(0.93 0.03 15)',  fg: 'oklch(0.50 0.08 15)'  },
  conj:  { bg: 'oklch(0.93 0.03 320)', fg: 'oklch(0.50 0.08 320)' },
  other: { bg: 'var(--ssz-bg-subtle)', fg: 'var(--ssz-text-muted)' },
};

export interface GlossaryPopoverProps {
  word: string;
  phonetic?: string;
  pos: PartOfSpeech;
  translation: string;
  audioSrc?: string;
  /**
   * When provided, renders an expandable "See in context" section inline in the
   * popover, showing this sentence with the word highlighted.
   * Takes precedence over `onSeeInContext`.
   */
  contextSentence?: string;
  /** Alternative: external navigation callback. */
  onSeeInContext?: () => void;
  children: ReactNode;
}

function highlightWord(sentence: string, word: string) {
  const re = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return sentence.split(re).map((part, i) =>
    part.toLowerCase() === word.toLowerCase() ? (
      <mark
        key={i}
        style={{
          background: 'oklch(0.62 0.105 168 / 16%)',
          color: 'oklch(0.44 0.09 168)',
          borderRadius: 3,
          padding: '0 2px',
          fontWeight: 700,
          fontStyle: 'normal',
        }}
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function GlossaryPopover({
  word,
  phonetic,
  pos,
  translation,
  audioSrc,
  contextSentence,
  onSeeInContext,
  children,
}: GlossaryPopoverProps) {
  const t = useTranslations('Learning.glossary');
  const [ctxOpen, setCtxOpen] = useState(false);
  const { bg, fg } = POS_STYLES[pos];

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        style={{ background: 'var(--ssz-bg-surface)', border: '1px solid var(--ssz-border-default)' }}
      >
        <div className="flex flex-col gap-0">
          {/* header */}
          <div className="flex items-start gap-2 p-3 pb-2">
            <div className="flex-1">
              <span
                className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: bg, color: fg }}
              >
                {pos}
              </span>
              <p
                className="font-reading text-xl font-semibold leading-tight text-(--ssz-text-primary)"
                lang="nb"
              >
                {word}
              </p>
              {phonetic && (
                <p className="mt-0.5 font-mono text-xs text-(--ssz-text-muted)">{phonetic}</p>
              )}
            </div>
            {audioSrc && (
              <AudioPlayer
                src={audioSrc}
                label={t('listenWord')}
                compact
                className="mt-1 shrink-0"
              />
            )}
          </div>

          {/* translation */}
          <div
            className="border-t px-3 py-2 text-sm font-semibold text-(--ssz-text-primary)"
            style={{ borderColor: 'var(--ssz-border-default)' }}
          >
            {translation}
          </div>

          {/* see in context — inline expansion */}
          {contextSentence && (
            <div style={{ borderTop: '1px solid var(--ssz-border-default)' }}>
              <button
                type="button"
                onClick={() => setCtxOpen((v) => !v)}
                className={cn(
                  'flex w-full items-center gap-1.5 px-3 py-2 text-left',
                  'text-xs font-semibold text-(--ssz-color-primary-600)',
                  'hover:bg-subtle',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--ssz-border-focus)',
                  'transition-colors',
                )}
                style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
                aria-expanded={ctxOpen}
              >
                <span className="flex-1">{t('seeInContext')}</span>
                {ctxOpen ? (
                  <ChevronDown size={12} aria-hidden="true" />
                ) : (
                  <ChevronRight size={12} aria-hidden="true" />
                )}
              </button>
              {ctxOpen && (
                <p
                  className="px-3 pb-3 font-reading text-[13.5px] leading-relaxed text-(--ssz-text-primary)"
                  lang="nb"
                >
                  {highlightWord(contextSentence, word)}
                </p>
              )}
            </div>
          )}

          {/* see in context — external navigation (legacy / non-inline) */}
          {!contextSentence && onSeeInContext && (
            <button
              type="button"
              onClick={onSeeInContext}
              className={cn(
                'border-t px-3 py-2 text-left text-xs font-medium',
                'text-[var(--ssz-color-primary-600)] hover:bg-[var(--ssz-bg-subtle)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ssz-border-focus)]',
                'transition-colors',
              )}
              style={{ borderColor: 'var(--ssz-border-default)', transitionDuration: 'var(--ssz-duration-fast)' }}
            >
              {t('seeInContext')} →
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
