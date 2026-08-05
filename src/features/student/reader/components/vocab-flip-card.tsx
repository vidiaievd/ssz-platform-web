'use client';

import { Loader2, Repeat, Volume2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { WordForms } from '@/features/learning/components/word-forms';
import { useWordAudio } from '@/features/learning/hooks/use-word-audio';
import type { VocabularyItem } from '@/features/content/types';
import { cn } from '@/lib/utils';

export type VocabCardMode = 'translation' | 'definition';

export const POS_META: Record<string, { bg: string; fg: string }> = {
  noun: { bg: 'var(--ssz-pos-noun-bg)', fg: 'var(--ssz-pos-noun-fg)' },
  verb: { bg: 'var(--ssz-pos-verb-bg)', fg: 'var(--ssz-pos-verb-fg)' },
  adjective: { bg: 'var(--ssz-pos-adj-bg)', fg: 'var(--ssz-pos-adj-fg)' },
  adverb: { bg: 'var(--ssz-pos-adv-bg)', fg: 'var(--ssz-pos-adv-fg)' },
  pronoun: { bg: 'var(--ssz-pos-pronoun-bg)', fg: 'var(--ssz-pos-pronoun-fg)' },
  preposition: { bg: 'var(--ssz-pos-prep-bg)', fg: 'var(--ssz-pos-prep-fg)' },
  conjunction: { bg: 'var(--ssz-pos-conj-bg)', fg: 'var(--ssz-pos-conj-fg)' },
  interjection: { bg: 'var(--ssz-pos-interjection-bg)', fg: 'var(--ssz-pos-interjection-fg)' },
  numeral: { bg: 'var(--ssz-pos-numeral-bg)', fg: 'var(--ssz-pos-numeral-fg)' },
  particle: { bg: 'var(--ssz-pos-particle-bg)', fg: 'var(--ssz-pos-particle-fg)' },
  phrase: { bg: 'var(--ssz-bg-subtle)', fg: 'var(--ssz-text-muted)' },
  other: { bg: 'var(--ssz-bg-subtle)', fg: 'var(--ssz-text-muted)' },
};

const OTHER_POS_META = POS_META.other as { bg: string; fg: string };

export function posMeta(partOfSpeech?: string) {
  return (partOfSpeech && POS_META[partOfSpeech]) || OTHER_POS_META;
}

/**
 * Plays a single word, wherever its sound comes from. Rendered as its own
 * component so the audio hook is not re-run for every card in a list, and it
 * swallows the click so tapping it never flips the card underneath.
 */
export function WordAudioButton({
  word,
  mediaId,
  lang,
  className,
}: {
  word: string;
  mediaId?: string;
  lang: string;
  className?: string;
}) {
  const t = useTranslations('Learning.reader.vocab');
  const { play, playing, pending } = useWordAudio(word, mediaId, lang);

  return (
    <button
      type="button"
      aria-label={t('listenTo', { word })}
      aria-busy={pending}
      onClick={(e) => {
        e.stopPropagation();
        play();
      }}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-(--ssz-border-default) bg-surface text-(--ssz-text-accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
        (playing || pending) && 'border-(--ssz-border-focus) bg-(--ssz-bg-accent)',
        className,
      )}
    >
      {pending ? (
        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
      ) : (
        <Volume2 size={15} aria-hidden="true" />
      )}
    </button>
  );
}

const REDUCED_MOTION_STYLE =
  '@media (prefers-reduced-motion: reduce) { .vfc-inner { transition: none !important; } }';

export interface VocabFlipCardProps {
  item: VocabularyItem;
  cardMode: VocabCardMode;
  /** Language of the word, for the pronunciation voice. */
  lang?: string;
  className?: string;
}

export function VocabFlipCard({ item, cardMode, lang = 'nb', className }: VocabFlipCardProps) {
  const t = useTranslations('Learning.reader.vocab');
  const locale = useLocale();
  const [flipped, setFlipped] = useState(false);

  const translation =
    item.translations.find((tr) => tr.languageCode === locale) ?? item.translations[0];
  const example = item.examples[0];
  const { bg, fg } = posMeta(item.partOfSpeech);
  const posKey = `pos.${item.partOfSpeech ?? 'other'}` as Parameters<typeof t>[0];
  const posLabel = t.has(posKey) ? t(posKey) : (item.partOfSpeech ?? t('pos.other'));

  return (
    <div className={className}>
      <style>{REDUCED_MOTION_STYLE}</style>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={t('flipCardLabel', { word: item.lemma })}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        className="h-46.5 cursor-pointer outline-none perspective-distant focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) focus-visible:ring-offset-2"
      >
        <div
          className="vfc-inner relative h-full w-full transform-3d"
          style={{
            transition: 'transform 480ms cubic-bezier(0.34,1.2,0.5,1)',
            transform: flipped ? 'rotateY(180deg)' : 'none',
          }}
        >
          {/* FRONT */}
          <div
            className="absolute inset-0 flex flex-col rounded-2xl border-[1.5px] border-(--ssz-border-default) bg-surface p-[18px_20px] shadow-(--ssz-shadow-sm) backface-hidden"
            style={{ zIndex: flipped ? 1 : 2 }}
          >
            <div className="mb-auto flex items-center gap-2">
              <span
                className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{ background: bg, color: fg }}
              >
                {posLabel}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-(--ssz-text-muted)">
                <Repeat size={12} aria-hidden="true" />
                {t('grunnform')}
              </span>
            </div>
            <div className="font-reading text-[30px] leading-[1.1] font-semibold text-(--ssz-text-primary)">
              {item.lemma}
            </div>
            {item.ipa && (
              <div className="mt-1.25 mb-auto font-mono text-xs text-(--ssz-text-muted)">
                {item.ipa}
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <WordAudioButton word={item.lemma} mediaId={item.audioMediaId} lang={lang} />
              <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-(--ssz-text-accent)">
                <Repeat size={13} aria-hidden="true" />
                {t('flipHint')}
              </span>
            </div>
          </div>

          {/* BACK */}
          <div
            className={cn(
              'absolute inset-0 flex flex-col rounded-2xl border-[1.5px] p-[18px_20px] shadow-(--ssz-shadow-sm) backface-hidden transform-[rotateY(180deg)]',
              cardMode === 'definition'
                ? 'border-(--ssz-border-default) bg-(--ssz-bg-accent)'
                : 'border-(--ssz-border-strong) bg-surface',
            )}
            style={{ zIndex: flipped ? 2 : 1 }}
          >
            <div className="mb-2 text-[10px] font-bold tracking-wider text-(--ssz-text-muted) uppercase">
              {cardMode === 'definition' ? t('backLabelDefinition') : t('backLabelTranslation')}
            </div>
            {cardMode === 'definition' ? (
              <div className="font-reading mb-auto text-[16.5px] leading-normal text-(--ssz-text-primary)">
                {translation?.definition || translation?.translation || '—'}
              </div>
            ) : (
              <div className="mb-auto text-xl font-bold text-(--ssz-text-primary)">
                {translation?.translation ?? '—'}
              </div>
            )}
            {example && (
              <div className="font-reading border-t border-(--ssz-border-default) pt-2.5 text-[13.5px] leading-relaxed text-(--ssz-text-secondary) italic">
                “{example.template}”
              </div>
            )}
          </div>
        </div>
      </div>

      <WordForms forms={item.forms ?? []} paradigm={item.paradigm} />
    </div>
  );
}
