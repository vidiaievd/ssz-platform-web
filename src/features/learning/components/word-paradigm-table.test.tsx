import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import type { VocabularyParadigm } from '@/features/content/types';
import { enMessages } from '@/lib/i18n/messages';

import { WordParadigmTable, splitEnding } from './word-paradigm-table';

const BIL: VocabularyParadigm = {
  kind: 'noun',
  gender: 'masculine',
  indefiniteSingular: 'bil',
  definiteSingular: 'bilen',
  indefinitePlural: 'biler',
  definitePlural: 'bilene',
};

/** A compound long enough that the matrix would overflow the rail. */
const AVDELINGSLEDER: VocabularyParadigm = {
  kind: 'noun',
  gender: 'masculine',
  indefiniteSingular: 'avdelingsleder',
  definiteSingular: 'avdelingslederen',
  indefinitePlural: 'avdelingsledere',
  definitePlural: 'avdelingslederne',
};

const SØKE: VocabularyParadigm = {
  kind: 'verb',
  infinitive: 'søke',
  present: 'søker',
  past: 'søkte',
  perfect: 'søkt',
};

function renderTable(paradigm: VocabularyParadigm, highlightValue?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WordParadigmTable paradigm={paradigm} highlightValue={highlightValue} />
    </NextIntlClientProvider>,
  );
}

describe('splitEnding', () => {
  it('picks out the inflection ending', () => {
    expect(splitEnding('bil', 'bilene')).toEqual(['bil', 'ene']);
    expect(splitEnding('søke', 'søkte')).toEqual(['søk', 'te']);
  });

  it('marks nothing when the form is the lemma', () => {
    expect(splitEnding('bil', 'bil')).toEqual(['bil', '']);
  });

  it('gives up on a multi-word form rather than marking half the cell', () => {
    expect(splitEnding('krysse fingrene', 'krysser fingrene')).toEqual(['krysser fingrene', '']);
  });

  it('gives up on a periphrastic degree, which shares no stem', () => {
    expect(splitEnding('erfaren', 'mest erfaren')).toEqual(['mest erfaren', '']);
  });

  it('survives a stem change without over-marking', () => {
    // "gaffel" → "gaflene": the shared prefix stops at the dropped vowel.
    expect(splitEnding('gaffel', 'gaflene')).toEqual(['gaf', 'lene']);
  });
});

describe('WordParadigmTable — nouns', () => {
  it('lays number against definiteness, so each cell is addressable by both axes', () => {
    renderTable(BIL);

    const flertall = screen.getByRole('row', { name: /flertall/i });
    expect(within(flertall).getByText('er')).toBeInTheDocument();
    expect(within(flertall).getByText('ene')).toBeInTheDocument();
    // "bilen" belongs to Entall, not to this row.
    expect(within(flertall).queryByText('en')).not.toBeInTheDocument();
  });

  it('derives the masculine article from the gender', () => {
    renderTable(BIL);
    expect(screen.getByRole('cell', { name: 'en bil' })).toBeInTheDocument();
  });

  it('derives the neuter article from the gender', () => {
    renderTable({ ...BIL, gender: 'neuter', indefiniteSingular: 'hus' } as VocabularyParadigm);
    expect(screen.getByRole('cell', { name: 'et hus' })).toBeInTheDocument();
  });

  it('shows no article when the gender is unknown', () => {
    renderTable({ ...BIL, gender: undefined } as VocabularyParadigm);
    expect(screen.getByRole('cell', { name: 'bil' })).toBeInTheDocument();
  });

  it('keeps a missing cell in place — the matrix axes must stay square', () => {
    renderTable({ ...BIL, definitePlural: undefined } as VocabularyParadigm);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('drops the matrix for a compound whose forms would overflow the rail', () => {
    renderTable(AVDELINGSLEDER);

    // One form per row: the pair of column headers the matrix needs is gone.
    expect(screen.queryByRole('columnheader', { name: /ubestemt/i })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /ubestemt entall/i })).toBeInTheDocument();
    // Anchored: "Bestemt flertall" is a suffix of "Ubestemt flertall" too.
    expect(screen.getByRole('row', { name: /^Bestemt flertall/ })).toBeInTheDocument();
  });

  it('keeps the article on the indefinite singular when it falls back to a list', () => {
    renderTable(AVDELINGSLEDER);

    const row = screen.getByRole('row', { name: /ubestemt entall/i });
    expect(within(row).getByText('en')).toBeInTheDocument();
  });

  it('still marks the form met in the text after falling back to a list', () => {
    const { container } = renderTable(AVDELINGSLEDER, 'avdelingslederen');

    const marked = container.querySelectorAll('[data-highlighted]');
    expect(marked).toHaveLength(1);
    expect(marked[0]?.textContent).toBe('avdelingslederen');
  });

  it('marks the cell holding the form met in the text', () => {
    const { container } = renderTable(BIL, 'biler');

    const marked = container.querySelectorAll('[data-highlighted]');
    expect(marked).toHaveLength(1);
    expect(marked[0]?.textContent).toBe('biler');
  });
});

describe('WordParadigmTable — sequences', () => {
  it('renders a verb as labelled tenses with their auxiliaries', () => {
    renderTable(SØKE);

    expect(within(screen.getByRole('row', { name: /infinitiv/i })).getByText('å')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /perfektum/i })).getByText('har')).toBeInTheDocument();
  });

  it('drops rows with no form instead of showing empty ones', () => {
    renderTable({ ...SØKE, past: undefined, perfect: undefined } as VocabularyParadigm);

    expect(screen.getByRole('row', { name: /presens/i })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /preteritum/i })).not.toBeInTheDocument();
  });

  it('renders the adjective degrees', () => {
    renderTable({
      kind: 'adjective',
      positive: 'erfaren',
      neuter: 'erfarent',
      plural: 'erfarne',
    });

    expect(screen.getByRole('row', { name: /intetkjønn/i })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /komparativ/i })).not.toBeInTheDocument();
  });
});
