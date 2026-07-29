'use client';

import { Repeat } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { AudioPlayer } from '@/features/learning/components/audio-player';
import { WordForms } from '@/features/learning/components/word-forms';
import { useMediaAsset } from '@/features/media';
import type { VocabularyItem } from '@/features/content/types';
import { cn } from '@/lib/utils';

export type VocabCardMode = 'translation' | 'definition';

const POS_META: Record<string, { bg: string; fg: string }> = {
  noun: { bg: 'oklch(0.93 0.05 235)', fg: 'oklch(0.44 0.10 235)' },
  verb: { bg: 'oklch(0.93 0.05 145)', fg: 'oklch(0.40 0.12 145)' },
  adjective: { bg: 'oklch(0.93 0.05 75)', fg: 'oklch(0.50 0.10 75)' },
  adverb: { bg: 'oklch(0.93 0.05 280)', fg: 'oklch(0.44 0.10 280)' },
  pronoun: { bg: 'oklch(0.93 0.04 200)', fg: 'oklch(0.46 0.09 200)' },
  preposition: { bg: 'oklch(0.93 0.03 15)', fg: 'oklch(0.50 0.08 15)' },
  conjunction: { bg: 'oklch(0.93 0.03 320)', fg: 'oklch(0.50 0.08 320)' },
  interjection: { bg: 'oklch(0.93 0.05 105)', fg: 'oklch(0.48 0.10 105)' },
  numeral: { bg: 'oklch(0.93 0.03 260)', fg: 'oklch(0.48 0.08 260)' },
  particle: { bg: 'oklch(0.93 0.03 340)', fg: 'oklch(0.48 0.08 340)' },
  phrase: { bg: 'var(--ssz-bg-subtle)', fg: 'var(--ssz-text-muted)' },
  other: { bg: 'var(--ssz-bg-subtle)', fg: 'var(--ssz-text-muted)' },
};

const OTHER_POS_META = POS_META.other as { bg: string; fg: string };

function posMeta(partOfSpeech?: string) {
  return (partOfSpeech && POS_META[partOfSpeech]) || OTHER_POS_META;
}

const REDUCED_MOTION_STYLE =
  '@media (prefers-reduced-motion: reduce) { .vfc-inner { transition: none !important; } }';

export interface VocabFlipCardProps {
  item: VocabularyItem;
  cardMode: VocabCardMode;
  className?: string;
}

export function VocabFlipCard({ item, cardMode, className }: VocabFlipCardProps) {
  const t = useTranslations('Learning.reader.vocab');
  const locale = useLocale();
  const [flipped, setFlipped] = useState(false);
  const asset = useMediaAsset(item.audioMediaId);

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
              <AudioPlayer
                src={asset.data?.url}
                label={t('listen')}
                interactive={!!item.audioMediaId}
                compact
                className="shrink-0"
              />
              <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-(--ssz-color-primary-600)">
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
                ? 'border-(--ssz-color-primary-300) bg-(--ssz-color-primary-50)'
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

      {item.forms && item.forms.length > 0 && <WordForms forms={item.forms} />}
    </div>
  );
}
