'use client';

import { ChevronDown, ChevronRight, Loader2, Volume2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { AudioPlayer } from '@/features/learning/components/audio-player';
import { WordForms } from '@/features/learning/components/word-forms';
import { useMediaAsset } from '@/features/media';

import { useWordAudio } from '../hooks/use-word-audio';
import type { VocabularyForm, VocabularyParadigm } from '@/features/content/types';
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

export const POS_STYLES: Record<PartOfSpeech, { bg: string; fg: string }> = {
  noun:  { bg: 'var(--ssz-pos-noun-bg)', fg: 'var(--ssz-pos-noun-fg)' },
  verb:  { bg: 'var(--ssz-pos-verb-bg)', fg: 'var(--ssz-pos-verb-fg)' },
  adj:   { bg: 'var(--ssz-pos-adj-bg)',  fg: 'var(--ssz-pos-adj-fg)'  },
  adv:   { bg: 'var(--ssz-pos-adv-bg)',  fg: 'var(--ssz-pos-adv-fg)'  },
  prep:  { bg: 'var(--ssz-pos-prep-bg)', fg: 'var(--ssz-pos-prep-fg)' },
  conj:  { bg: 'var(--ssz-pos-conj-bg)', fg: 'var(--ssz-pos-conj-fg)' },
  other: { bg: 'var(--ssz-bg-subtle)',   fg: 'var(--ssz-text-muted)' },
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
  /** BCP-47 language of the word — picks the pronunciation voice. */
  lang?: string;
  /** Inflected forms for the "Alle former" drawer. */
  forms?: VocabularyForm[];
  /** Grid view of the same forms; preferred over `forms` when the item has one. */
  paradigm?: VocabularyParadigm;
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
  /**
   * A panel elsewhere owns the full card, so this popover never leaves its
   * hover hint — clicking calls `onSelect` instead of expanding in place.
   */
  previewOnly?: boolean;
  /** Fired on click/Enter when the word is chosen. Paired with `previewOnly`. */
  onSelect?: () => void;
  /**
   * Fired when the card opens, and again when a hover preview is promoted to
   * the full card — the two moments lookup telemetry records (spec 18 §6.1).
   * Never fired for a re-render or for closing.
   */
  onOpenLevel?: (level: GlossaryLevel) => void;
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

/**
 * The whole popover when a panel owns the full card: the one thing a reader
 * wants mid-sentence — what the word means — plus a way to hear it.
 *
 * Everything else the old hint promised ("click for translation") is now a
 * click away in the rail, so promising it here would be a step backwards: the
 * meaning is what the hover was for.
 */
function MiniPreview({
  pos,
  bg,
  fg,
  word,
  lang,
  translation,
  audioMediaId,
}: {
  pos: PartOfSpeech;
  bg: string;
  fg: string;
  word: string;
  lang?: string;
  translation: string;
  audioMediaId?: string;
}) {
  const t = useTranslations('Learning.glossary');
  const { play, playing, pending } = useWordAudio(word, audioMediaId, lang);

  return (
    <div className="flex items-center gap-2 px-2.5 py-2">
      <span
        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider uppercase"
        style={{ background: bg, color: fg }}
      >
        {pos}
      </span>
      <span className="min-w-0 text-[13px] font-semibold text-(--ssz-text-primary)">{translation}</span>
      <button
        type="button"
        onClick={play}
        aria-label={t('listenWord')}
        aria-busy={pending}
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full',
          'text-(--ssz-text-muted) hover:bg-subtle hover:text-(--ssz-text-accent)',
          'focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) focus-visible:outline-none',
          (playing || pending) && 'text-(--ssz-text-accent)',
        )}
      >
        {pending ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : (
          <Volume2 size={13} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function GlossaryPopover({
  word,
  phonetic,
  pos,
  translation,
  audioSrc,
  audioMediaId,
  lang,
  forms,
  paradigm,
  form,
  formLabel,
  contextSentence,
  onSeeInContext,
  footer,
  previewOnly = false,
  onSelect,
  onOpenLevel,
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
      onOpenLevel?.('preview');
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
    if (previewOnly) {
      // The hint has served its purpose once the card is elsewhere; leaving it
      // hanging over the next line is exactly what moving the card avoided.
      e.preventDefault();
      setOpen(false);
      onSelect?.();
      return;
    }
    if (open && level === 'preview') {
      // Promote the hint in place — Radix would otherwise toggle the popover shut.
      e.preventDefault();
      setLevel('full');
      onOpenLevel?.('full');
      return;
    }
    if (!open) {
      setLevel('full');
      onOpenLevel?.('full');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // The trigger is a span with role="button": neither key fires a click on it.
    e.preventDefault();
    if (previewOnly) {
      clearTimers();
      setOpen(false);
      onSelect?.();
      return;
    }
    if (open && level === 'full') {
      handleOpenChange(false);
      return;
    }
    clearTimers();
    setLevel('full');
    setOpen(true);
    onOpenLevel?.('full');
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
        data-level={previewOnly ? 'mini' : level}
        className={cn(
          'p-0',
          previewOnly ? 'w-auto max-w-64' : 'w-64',
          // A hint must never swallow the pointer that is still reading the
          // line. The mini card is exempt: it carries a play button, and the
          // 400ms hover intent has already filtered out mere skimming.
          !previewOnly && level === 'preview' && 'pointer-events-none',
        )}
        style={{ background: 'var(--ssz-bg-surface)', border: '1px solid var(--ssz-border-default)' }}
        onOpenAutoFocus={(e) => {
          if (previewOnly || level === 'preview') e.preventDefault();
        }}
      >
        {previewOnly ? (
          <MiniPreview
            pos={pos}
            bg={bg}
            fg={fg}
            word={word}
            lang={lang}
            translation={translation}
            audioMediaId={audioMediaId}
          />
        ) : (
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

              {((forms && forms.length > 0) || paradigm) && (
                <div className="px-3 pb-1">
                  <WordForms
                    forms={forms ?? []}
                    paradigm={paradigm}
                    density="compact"
                    highlightValue={form}
                  />
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
        )}
      </PopoverContent>
    </Popover>
  );
}
