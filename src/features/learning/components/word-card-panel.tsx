'use client';

import { ExternalLink, Volume2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { useWordAudio } from '../hooks/use-word-audio';
import { DICTIONARY_HOST, dictionaryUrl } from '../lib/dictionary-link';
import { getGlossaryMode } from '../lib/glossary-mode';
import { useSelectedWordStore, type SelectedWord } from '../stores/selected-word-store';
import { POS_STYLES } from './glossary-popover';
import { KnowWordButton } from './know-word-button';
import { WordForms } from './word-forms';
import { WordParadigmTable } from './word-paradigm-table';
import { toGlossaryTag } from '../lib/pos-tag';

export interface WordCardPanelProps {
  /** BCP-47 tag of the text's language — picks the voice and the dictionary. */
  targetLanguage: string;
  /** Reader's CEFR level: B2+ sees a target-language definition instead of a translation. */
  cefrLevel?: string;
  className?: string;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10.5px] font-bold tracking-wide text-(--ssz-text-muted) uppercase">
      {children}
    </h3>
  );
}

function Card({
  selected,
  targetLanguage,
  cefrLevel,
  onClose,
}: {
  selected: SelectedWord;
  targetLanguage: string;
  cefrLevel?: string;
  onClose: () => void;
}) {
  const t = useTranslations('Learning.glossary');
  const locale = useLocale();
  const { item, form, formLabel, contextSentence } = selected;

  const { play, playing, source } = useWordAudio(item.lemma, item.audioMediaId, targetLanguage);
  const href = dictionaryUrl(item.lemma, targetLanguage);

  const translation = item.translations.find((tr) => tr.languageCode === locale) ?? item.translations[0];
  const mode = getGlossaryMode(cefrLevel ?? '');
  const gloss =
    mode === 'definition'
      ? translation?.definition || translation?.translation || item.lemma
      : (translation?.translation ?? item.lemma);

  const pos = toGlossaryTag(item.partOfSpeech);
  const { bg, fg } = POS_STYLES[pos];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/*
        Kept when a word is showing, not only in the empty state: it is what
        names this block in the rail, alongside the audio and reading sections.
        The negative margin pulls it back against the column's own gap, so
        labelling the block costs a line of text rather than a whole row.
      */}
      <div className="-mb-3">
        <SectionHeading>{t('wordCardTitle')}</SectionHeading>
      </div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <span
            className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
            style={{ background: bg, color: fg }}
          >
            {pos}
          </span>
          <p
            className="font-reading text-xl leading-tight font-semibold break-words text-(--ssz-text-primary)"
            lang={targetLanguage}
          >
            {item.lemma}
          </p>
          {item.ipa && <p className="mt-0.5 font-mono text-xs text-(--ssz-text-muted)">{item.ipa}</p>}
          {!!form && !!formLabel && (
            <p className="mt-1 text-[12.5px] text-(--ssz-text-muted)">
              {t('inText', { form, label: formLabel })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* Hidden outright when there is neither a recording nor a voice: a
              dead play button is worse than no play button. */}
          {source !== 'none' && (
            <button
              type="button"
              onClick={play}
              aria-label={t('listenWord')}
              className={cn(
                'flex size-8 items-center justify-center rounded-full border border-(--ssz-border-default)',
                'text-(--ssz-text-secondary) hover:border-(--ssz-color-primary-500) hover:text-(--ssz-color-primary-600)',
                'focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) focus-visible:outline-none',
                playing && 'border-(--ssz-color-primary-500) text-(--ssz-color-primary-600)',
              )}
            >
              <Volume2 size={15} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeCard')}
            className="flex size-8 items-center justify-center rounded-full text-(--ssz-text-muted) hover:bg-subtle focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus) focus-visible:outline-none"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* The one line the reader came for — sized to be read, not skimmed. */}
      <p className="text-base leading-snug font-semibold text-(--ssz-text-primary)">{gloss}</p>

      {(item.paradigm || (item.forms && item.forms.length > 0)) && (
        <section>
          <SectionHeading>{t('inflection')}</SectionHeading>
          {item.paradigm ? (
            <WordParadigmTable paradigm={item.paradigm} highlightValue={form} />
          ) : (
            <WordForms forms={item.forms ?? []} highlightValue={form} defaultOpen />
          )}
        </section>
      )}

      {contextSentence && (
        <section>
          <SectionHeading>{t('inContext')}</SectionHeading>
          <p
            className="font-reading text-sm leading-relaxed text-(--ssz-text-secondary) italic"
            lang={targetLanguage}
          >
            “{contextSentence}”
          </p>
        </section>
      )}

      <div className="flex flex-col items-start gap-2 border-t border-(--ssz-border-default) pt-3">
        <KnowWordButton vocabularyItemId={item.id} />
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs font-semibold text-(--ssz-text-link) hover:underline"
          >
            {t('lookUpIn', { source: DICTIONARY_HOST })}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * The rail's word card: what the glossary popover used to show in full, moved
 * out of the prose so it neither covers the sentence being read nor has to fit
 * a 256px floating box.
 *
 * Renders its own empty state rather than nothing, so the column does not
 * appear and vanish as the reader taps words — the layout would jump on every
 * lookup.
 */
export function WordCardPanel({ targetLanguage, cefrLevel, className }: WordCardPanelProps) {
  const t = useTranslations('Learning.glossary');
  const selected = useSelectedWordStore((s) => s.selected);
  const clear = useSelectedWordStore((s) => s.clear);

  return (
    <div className={cn('border-t border-(--ssz-border-default)', className)}>
      {selected ? (
        <Card
          // Remounts per word: the audio hook's playing state and the forms
          // drawer both belong to one word, not to the panel.
          key={selected.item.id}
          selected={selected}
          targetLanguage={targetLanguage}
          cefrLevel={cefrLevel}
          onClose={clear}
        />
      ) : (
        <div className="p-4">
          <SectionHeading>{t('wordCardTitle')}</SectionHeading>
          <p className="text-xs text-(--ssz-text-muted)">{t('wordCardEmpty')}</p>
        </div>
      )}
    </div>
  );
}
