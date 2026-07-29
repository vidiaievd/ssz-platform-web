import { render, screen, within, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { VocabularyItem } from '@/features/content/types';
import { buildGlossaryIndex } from '../lib/tokenize-glossary';

const useMediaAsset = vi.fn((_id?: string) => ({ data: undefined }));
vi.mock('@/features/media', () => ({ useMediaAsset: (id?: string) => useMediaAsset(id) }));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { LessonProse } = await import('./lesson-prose');

const FAGBREV: VocabularyItem = {
  id: 'v1',
  lemma: 'fagbrev',
  partOfSpeech: 'noun',
  translations: [{ languageCode: 'en', translation: 'trade certificate' }],
  examples: [],
};

const ERFARING: VocabularyItem = {
  id: 'v2',
  lemma: 'erfaring',
  partOfSpeech: 'noun',
  forms: [{ label: 'Ubestemt flertall', value: 'erfaringer' }],
  translations: [{ languageCode: 'en', translation: 'experience' }],
  examples: [],
};

// The job ad from «1A — Bartek søker ny jobb», as content-service hands it over.
const JOB_AD = [
  '> **Erfaren elektriker søkes**',
  '>',
  '> Nordby Elektro AS er et voksende firma med tolv ansatte.',
  '>',
  '> **Vi ønsker at du:**',
  '> - har fagbrev som elektriker',
  '> - har minst tre års erfaring',
].join('\n');

function renderProse(text: string, items: VocabularyItem[] = []) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LessonProse text={text} glossary={buildGlossaryIndex(items)} />
    </NextIntlClientProvider>,
  );
}

describe('LessonProse', () => {
  it('renders markdown structure instead of its source characters', () => {
    const { container } = renderProse(JOB_AD);

    expect(container.textContent).not.toMatch(/[>*]/);
    expect(container.querySelector('blockquote')).toBeInTheDocument();
    expect(screen.getByText('Erfaren elektriker søkes').tagName).toBe('STRONG');

    const items = within(container.querySelector('ul')!).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'har fagbrev som elektriker',
      'har minst tre års erfaring',
    ]);
  });

  it('joins a soft-wrapped paragraph into flowing text', () => {
    renderProse('Bartek har jobbet som elektriker i det samme\nfirmaet i tre år.');
    expect(
      screen.getByText('Bartek har jobbet som elektriker i det samme firmaet i tre år.'),
    ).toBeInTheDocument();
  });

  it('renders a heading as a heading element', () => {
    renderProse('## Forstå teksten');
    expect(screen.getByRole('heading', { name: 'Forstå teksten' })).toBeInTheDocument();
  });

  it('keeps a date at the start of a line out of a list', () => {
    const { container } = renderProse('17. mai er Norges nasjonaldag.');
    expect(container.querySelector('ul')).not.toBeInTheDocument();
    expect(screen.getByText('17. mai er Norges nasjonaldag.')).toBeInTheDocument();
  });

  it('looks up a glossary word inside a list item', () => {
    renderProse(JOB_AD, [FAGBREV]);

    const trigger = screen.getByRole('button', { name: /look up: fagbrev/i });
    fireEvent.click(trigger);
    expect(screen.getByText('trade certificate')).toBeInTheDocument();
  });

  it('looks up a glossary word that sits inside a bold run, without splitting it', () => {
    renderProse('> **Erfaren elektriker med lang erfaring søkes**', [ERFARING]);

    const triggers = screen.getAllByRole('button', { name: /look up: erfaring/i });
    expect(triggers).toHaveLength(1);
    expect(triggers[0]!.textContent).toBe('erfaring');
    // The emphasis still applies to the word, it is just nested inside the trigger.
    expect(triggers[0]!.querySelector('strong')).toBeInTheDocument();
  });

  it('does not request audio for words that are not glossary-marked', () => {
    useMediaAsset.mockClear();
    renderProse('Nordby Elektro AS er et voksende firma.', []);
    expect(useMediaAsset).not.toHaveBeenCalled();
  });
});
