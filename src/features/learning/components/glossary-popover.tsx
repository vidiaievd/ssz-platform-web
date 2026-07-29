'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { AudioPlayer } from '@/features/learning/components/audio-player';
import { WordForms } from '@/features/learning/components/word-forms';
import { useMediaAsset } from '@/features/media';
import type { VocabularyForm } from '@/features/content/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type PartOfSpeech = 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'conj' | 'other';

/** How much of the entry is shown: a hover hint, or the card the learner asked for. */
export type GlossaryLevel = 'preview' | 'full';

/** Hover-intent delays (ms), long enough that skimming a line opens nothing. */
const OPEN_DELAY = 400;
const CLOSE_DELAY = 150;

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
  /** Ready-made audio URL. In lesson prose prefer `audioMediaId` — it resolves lazily. */
  audioSrc?: string;
  /** Resolved to a URL only when the full card opens, so a paragraph of marked words costs no requests. */
  audioMediaId?: string;
  /** Inflected forms for the "Alle former" drawer. */
  forms?: VocabularyForm[];
  /** The surface form met in the text — highlighted among `forms`. */
  form?: string;
  /** Label of that form ("Bestemt entall"); null when the form is the lemma itself. */
  formLabel?: string | null;
  /**
   * When provided, renders an expandable "See in context" section inline in the
   * popover, showing this sentence with the word highlighted.
   * Takes precedence over `onSeeInContext`.
   */
  contextSentence?: string;
  /** Alternative: external navigation callback. */
  onSeeInContext?: () => void;
  /** Extra actions pinned under the card (B3: "I know this word"). */
  footer?: ReactNode;
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

/** Pointers that cannot hover (touch) must never get the hover branch. */
function hoverCapable() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(hover: none)').matches;
}

/** Mounted only inside the full card, so the media request follows the learner's intent. */
function GlossaryAudio({ mediaId, label }: { mediaId: string; label: string }) {
  const asset = useMediaAsset(mediaId);
  return <AudioPlayer src={asset.data?.url} label={label} compact className="mt-1 shrink-0" />;
}

export function GlossaryPopover({
  word,
  phonetic,
  pos,
  translation,
  audioSrc,
  audioMediaId,
  forms,
  form,
  formLabel,
  contextSentence,
  onSeeInContext,
  footer,
  children,
}: GlossaryPopoverProps) {
  const t = useTranslations('Learning.glossary');
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<GlossaryLevel>('preview');
  const [ctxOpen, setCtxOpen] = useState(false);
  const { bg, fg } = POS_STYLES[pos];

  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearTimers = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  function handleOpenChange(next: boolean) {
    clearTimers();
    if (!next) setCtxOpen(false);
    setOpen(next);
  }

  function handlePointerEnter(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse' || !hoverCapable()) return;
    clearTimers();
    if (open) return;
    openTimer.current = setTimeout(() => {
      setLevel('preview');
      setOpen(true);
    }, OPEN_DELAY);
  }

  function handlePointerLeave(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(openTimer.current);
    // A card opened on purpose stays until it is dismissed on purpose.
    if (!open || level === 'full') return;
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }

  function handleClick(e: React.MouseEvent) {
    clearTimers();
    if (open && level === 'preview') {
      // Promote the hint in place — Radix would otherwise toggle the popover shut.
      e.preventDefault();
      setLevel('full');
      return;
    }
    if (!open) setLevel('full');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // The trigger is a span with role="button": neither key fires a click on it.
    e.preventDefault();
    if (open && level === 'full') {
      handleOpenChange(false);
      return;
    }
    clearTimers();
    setLevel('full');
    setOpen(true);
  }

  const showInText = !!form && !!formLabel;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        asChild
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        data-level={level}
        // A hint must never swallow the pointer that is still reading the line.
        className={cn('w-64 p-0', level === 'preview' && 'pointer-events-none')}
        style={{ background: 'var(--ssz-bg-surface)', border: '1px solid var(--ssz-border-default)' }}
        onOpenAutoFocus={(e) => {
          if (level === 'preview') e.preventDefault();
        }}
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
              {showInText && (
                <p className="mt-1 text-[11px] text-(--ssz-text-muted)">
                  {t('inText', { form: form, label: formLabel })}
                </p>
              )}
            </div>
            {level === 'full' &&
              (audioMediaId ? (
                <GlossaryAudio mediaId={audioMediaId} label={t('listenWord')} />
              ) : (
                audioSrc && (
                  <AudioPlayer src={audioSrc} label={t('listenWord')} compact className="mt-1 shrink-0" />
                )
              ))}
          </div>

          {level === 'preview' ? (
            <div
              className="border-t px-3 py-2 text-[11px] font-semibold text-(--ssz-color-primary-600)"
              style={{ borderColor: 'var(--ssz-border-default)' }}
            >
              {t('clickForTranslation')}
            </div>
          ) : (
            <>
              {/* translation */}
              <div
                className="border-t px-3 py-2 text-sm font-semibold text-(--ssz-text-primary)"
                style={{ borderColor: 'var(--ssz-border-default)' }}
              >
                {translation}
              </div>

              {forms && forms.length > 0 && (
                <div className="px-3 pb-1">
                  <WordForms forms={forms} density="compact" highlightValue={form} />
                </div>
              )}

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
                      {highlightWord(contextSentence, form || word)}
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

              {footer && (
                <div className="border-t px-3 py-2" style={{ borderColor: 'var(--ssz-border-default)' }}>
                  {footer}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
