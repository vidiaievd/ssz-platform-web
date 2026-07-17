import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { VocabularyItem } from '@/features/content/types';

const useMediaAsset = vi.fn();
vi.mock('@/features/media', () => ({ useMediaAsset: (id?: string) => useMediaAsset(id) }));

const { VocabFlipCard } = await import('./vocab-flip-card');

const NOUN_ITEM: VocabularyItem = {
  id: 'v1',
  lemma: 'sykepleier',
  partOfSpeech: 'noun',
  ipa: '/ˈsyːkəˌplɛɪər/',
  audioMediaId: 'media-1',
  translations: [
    { languageCode: 'en', translation: 'nurse', definition: 'a person who cares for the sick' },
  ],
  examples: [{ id: 'ex-1', template: 'Marta er sykepleier.', substitution: '' }],
  forms: [
    { label: 'Ubestemt entall', value: 'en sykepleier' },
    { label: 'Bestemt entall', value: 'sykepleieren' },
  ],
};

function renderCard(props: Partial<React.ComponentProps<typeof VocabFlipCard>> = {}) {
  useMediaAsset.mockReturnValue({ data: { id: 'media-1', url: 'https://cdn.test/audio.mp3' } });
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <VocabFlipCard item={NOUN_ITEM} cardMode="translation" {...props} />
    </NextIntlClientProvider>,
  );
}

describe('VocabFlipCard', () => {
  it('shows the front face (lemma, POS, IPA) by default and flips on click', () => {
    renderCard();
    expect(screen.getByText('sykepleier')).toBeInTheDocument();
    expect(screen.getByText('Noun')).toBeInTheDocument();
    expect(screen.getByText('/ˈsyːkəˌplɛɪər/')).toBeInTheDocument();

    const card = screen.getByRole('button', { name: /flip card: sykepleier/i });
    expect(card).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(card);
    expect(card).toHaveAttribute('aria-pressed', 'true');
  });

  it('flips via keyboard (Enter/Space)', () => {
    renderCard();
    const card = screen.getByRole('button', { name: /flip card: sykepleier/i });
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(card).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(card, { key: ' ' });
    expect(card).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the translation on the back when cardMode is translation (A1–B1)', () => {
    renderCard({ cardMode: 'translation' });
    expect(screen.getByText('nurse')).toBeInTheDocument();
    expect(screen.queryByText('a person who cares for the sick')).not.toBeInTheDocument();
  });

  it('shows the definition on the back when cardMode is definition (B2+)', () => {
    renderCard({ cardMode: 'definition' });
    expect(screen.getByText('a person who cares for the sick')).toBeInTheDocument();
    expect(screen.queryByText('nurse', { selector: 'div' })).not.toBeInTheDocument();
  });

  it('renders the example sentence', () => {
    renderCard();
    expect(screen.getByText('“Marta er sykepleier.”')).toBeInTheDocument();
  });

  it('toggles the "all forms" drawer and renders each form row', () => {
    renderCard();
    expect(screen.queryByText('en sykepleier')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All forms' }));
    expect(screen.getByText('Ubestemt entall')).toBeInTheDocument();
    expect(screen.getByText('en sykepleier')).toBeInTheDocument();
    expect(screen.getByText('Bestemt entall')).toBeInTheDocument();
    expect(screen.getByText('sykepleieren')).toBeInTheDocument();
  });

  it('omits the "all forms" drawer entirely when the item has no forms', () => {
    renderCard({ item: { ...NOUN_ITEM, forms: undefined } });
    expect(screen.queryByRole('button', { name: 'All forms' })).not.toBeInTheDocument();
  });
});
