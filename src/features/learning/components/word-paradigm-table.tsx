'use client';

import { useTranslations } from 'next-intl';

import type { VocabularyGender, VocabularyParadigm } from '@/features/content/types';
import { cn } from '@/lib/utils';

export interface WordParadigmTableProps {
  paradigm: VocabularyParadigm;
  /** The surface form met in the text — its cell is marked. */
  highlightValue?: string;
  className?: string;
}

/**
 * Grammatical labels stay in Norwegian, matching the flat forms list: they are
 * the target language's own terms, shown to a learner of Norwegian next to the
 * forms themselves, not UI chrome. Only the screen-reader caption is translated.
 */
const ARTICLE: Record<VocabularyGender, string> = {
  masculine: 'en',
  feminine: 'ei',
  neuter: 'et',
  common: 'en',
};

/**
 * Splits a form into the stem it shares with the lemma and the ending that
 * marks it — "bil|en", "søk|te" — so the table can show what actually changes
 * rather than four look-alike strings.
 *
 * Deliberately gives up rather than guessing: a multi-word form ("krysser
 * fingrene") and a periphrastic degree ("mest erfaren") share little or nothing
 * with the lemma, and marking half the cell there would teach the wrong thing.
 */
export function splitEnding(lemma: string, value: string): [stem: string, ending: string] {
  let i = 0;
  const max = Math.min(lemma.length, value.length);
  while (i < max && lemma.charAt(i).toLocaleLowerCase() === value.charAt(i).toLocaleLowerCase()) i++;

  const ending = value.slice(i);
  if (ending.length > 5 || ending.includes(' ')) return [value, ''];
  return [value.slice(0, i), ending];
}

/** One filled cell: an optional muted particle, the stem, and the ending picked out. */
function Form({
  value,
  lemma,
  particle,
  highlighted,
}: {
  value: string;
  lemma: string;
  particle?: string;
  highlighted: boolean;
}) {
  const [stem, ending] = splitEnding(lemma, value);

  return (
    <span className="font-reading text-[15px] text-(--ssz-text-primary)" lang="nb">
      {/*
        The separator is a text node outside the span, not a margin and not text
        inside it: the accessible-name algorithm trims each element's own text
        before joining, so both of those yield "enbil" to a screen reader.
      */}
      {/*
        Same colour as the form it precedes — weight alone separates them. A
        muted particle read as a different tier of information ("å" greyer than
        "krysse") when it is simply part of the same form.
      */}
      {particle && (
        <>
          <span className="font-normal">{particle}</span>{' '}
        </>
      )}
      <span className={highlighted ? 'font-bold' : 'font-medium'}>{stem}</span>
      {ending && (
        <span className="font-bold text-(--ssz-text-accent)">{ending}</span>
      )}
    </span>
  );
}

const CELL = 'border border-(--ssz-border-default) px-2.5 py-1.5 text-left align-baseline';
const HEAD = cn(CELL, 'bg-subtle text-[10.5px] font-semibold tracking-wide text-(--ssz-text-muted) uppercase');

interface Cell {
  value?: string;
  particle?: string;
}

/**
 * Longest form the noun matrix can hold before it stops fitting the rail.
 *
 * The matrix is `w-full` but `table-layout: auto`, so min-content wins: two
 * form columns plus the row label plus six cell paddings is wider than the
 * rail's ~320px of content once a form passes roughly this length, and the
 * overflow is clipped by the rail rather than wrapped. Norwegian compounds
 * ("avdelingslederen", "stillingsannonsene") clear it easily.
 */
const MATRIX_FORM_LIMIT = 10;

/**
 * A label/value list — one form per row, so the form column gets the full width.
 *
 * Rows with no form are dropped: unlike the noun matrix there are no axes to
 * keep square here, and an empty row is just noise.
 */
function SequenceTable({
  rows,
  lemma,
  caption,
  isHit,
  className,
}: {
  rows: [label: string, cell: Cell][];
  lemma: string;
  caption: React.ReactNode;
  isHit: (value?: string) => boolean;
  className?: string;
}) {
  return (
    <table className={cn('w-full border-collapse', className)}>
      {caption}
      <tbody>
        {rows
          .filter(([, cell]) => !!cell.value)
          .map(([label, cell]) => (
            <tr key={label}>
              <th className={cn(HEAD, 'w-[42%]')} scope="row">
                {label}
              </th>
              <td
                data-highlighted={isHit(cell.value) || undefined}
                className={cn(CELL, isHit(cell.value) && 'bg-(--ssz-bg-accent)')}
              >
                <Form
                  value={cell.value!}
                  lemma={lemma}
                  particle={cell.particle}
                  highlighted={isHit(cell.value)}
                />
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

/**
 * The inflection paradigm as a bordered grid.
 *
 * Nouns get a real two-dimensional matrix — number against definiteness — because
 * that is the shape of the grammar and because four cells across do not survive
 * a 320px rail once compounds like "stillingsannonsene" are in them. Two cells
 * across do not survive them either, so a noun whose forms pass
 * `MATRIX_FORM_LIMIT` falls back to the same label/value list verbs and
 * adjectives use: losing the axes reads better than a matrix clipped at the
 * rail's edge. Verbs and adjectives are one-dimensional sequences to begin
 * with, so a matrix there would only pretend to have axes.
 *
 * Empty cells are kept in the noun matrix (the axes must stay square) but
 * dropped entirely from the sequences, where a row with no form is just noise.
 */
export function WordParadigmTable({ paradigm, highlightValue, className }: WordParadigmTableProps) {
  const t = useTranslations('Learning.reader.vocab');
  const normalized = highlightValue?.toLocaleLowerCase();
  const isHit = (value?: string) => !!value && !!normalized && value.toLocaleLowerCase() === normalized;

  const lemma =
    paradigm.kind === 'noun'
      ? paradigm.indefiniteSingular
      : paradigm.kind === 'verb'
        ? paradigm.infinitive
        : paradigm.positive;

  const caption = <caption className="sr-only">{t('inflectionOf', { word: lemma })}</caption>;

  if (paradigm.kind === 'noun') {
    const article = paradigm.gender ? ARTICLE[paradigm.gender] : undefined;
    const forms = [
      paradigm.indefiniteSingular,
      paradigm.definiteSingular,
      paradigm.indefinitePlural,
      paradigm.definitePlural,
    ];

    if (forms.some((form) => (form?.length ?? 0) > MATRIX_FORM_LIMIT)) {
      return (
        <SequenceTable
          rows={[
            ['Ubestemt entall', { value: paradigm.indefiniteSingular, particle: article }],
            ['Bestemt entall', { value: paradigm.definiteSingular }],
            ['Ubestemt flertall', { value: paradigm.indefinitePlural }],
            ['Bestemt flertall', { value: paradigm.definitePlural }],
          ]}
          lemma={lemma}
          caption={caption}
          isHit={isHit}
          className={className}
        />
      );
    }

    const rows: [label: string, indefinite: Cell, definite: Cell][] = [
      [
        'Entall',
        { value: paradigm.indefiniteSingular, particle: article },
        { value: paradigm.definiteSingular },
      ],
      ['Flertall', { value: paradigm.indefinitePlural }, { value: paradigm.definitePlural }],
    ];

    return (
      <table className={cn('w-full border-collapse', className)}>
        {caption}
        <thead>
          <tr>
            <th className={HEAD} scope="col">
              <span className="sr-only">{t('inflection')}</span>
            </th>
            <th className={HEAD} scope="col">
              Ubestemt
            </th>
            <th className={HEAD} scope="col">
              Bestemt
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, indefinite, definite]) => (
            <tr key={label}>
              <th className={HEAD} scope="row">
                {label}
              </th>
              {[indefinite, definite].map((cell, i) => (
                <td
                  key={i}
                  data-highlighted={isHit(cell.value) || undefined}
                  className={cn(CELL, isHit(cell.value) && 'bg-(--ssz-bg-accent)')}
                >
                  {cell.value ? (
                    <Form
                      value={cell.value}
                      lemma={lemma}
                      particle={cell.particle}
                      highlighted={isHit(cell.value)}
                    />
                  ) : (
                    <span className="text-(--ssz-text-muted)" aria-hidden="true">
                      —
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const rows: [label: string, cell: Cell][] =
    paradigm.kind === 'verb'
      ? [
          ['Infinitiv', { value: paradigm.infinitive, particle: 'å' }],
          ['Presens', { value: paradigm.present }],
          ['Preteritum', { value: paradigm.past }],
          ['Perfektum', { value: paradigm.perfect, particle: 'har' }],
        ]
      : [
          ['Positiv', { value: paradigm.positive }],
          ['Intetkjønn', { value: paradigm.neuter }],
          ['Flertall', { value: paradigm.plural }],
          ['Komparativ', { value: paradigm.comparative }],
          ['Superlativ', { value: paradigm.superlative }],
        ];

  return (
    <SequenceTable rows={rows} lemma={lemma} caption={caption} isHit={isHit} className={className} />
  );
}
