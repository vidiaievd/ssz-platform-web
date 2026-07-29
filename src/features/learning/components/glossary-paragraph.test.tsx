import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { VocabularyItem } from '@/features/content/types';
import { buildGlossaryIndex } from '../lib/tokenize-glossary';
import { useKnownWordsStore } from '../stores/known-words-store';

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

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const introduceCardMutate = vi.fn();
const useIntroduceCard = vi.fn(() => ({ mutate: introduceCardMutate, isPending: false }));
vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return { ...actual, useIntroduceCard: () => useIntroduceCard() };
});

const { GlossaryParagraph } = await import('./glossary-paragraph');

const SYKEPLEIER: VocabularyItem = {
  id: 'v1',
  lemma: 'sykepleier',
  partOfSpeech: 'noun',
  translations: [{ languageCode: 'en', translation: 'nurse' }],
  examples: [],
};

function renderParagraph(text: string, items: VocabularyItem[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <GlossaryParagraph text={text} glossary={buildGlossaryIndex(items)} />
    </NextIntlClientProvider>,
  );
}

describe('GlossaryParagraph', () => {
  afterEach(() => {
    introduceCardMutate.mockReset();
    useKnownWordsStore.setState({ known: new Set() });
  });

  it('renders plain text untagged when there is no glossary match', () => {
    renderParagraph('En vanlig arbeidsdag.', []);
    expect(screen.getByText('En vanlig arbeidsdag.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a glossary-marked word as a lookup trigger and opens its popover', () => {
    renderParagraph('Marta er sykepleier på sykehuset.', [SYKEPLEIER]);

    const trigger = screen.getByRole('button', { name: /look up: sykepleier/i });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByText('nurse')).toBeInTheDocument();
  });

  it('introduces the SRS card as claimed-known and drops the underline when "I know this word" is clicked', () => {
    renderParagraph('Marta er sykepleier på sykehuset.', [SYKEPLEIER]);

    const trigger = screen.getByRole('button', { name: /look up: sykepleier/i });
    fireEvent.click(trigger);
    expect(trigger.className).toMatch(/underline/);

    fireEvent.click(screen.getByRole('button', { name: 'I know this word' }));

    expect(introduceCardMutate).toHaveBeenCalledWith(
      { contentType: 'VOCABULARY_WORD', contentId: 'v1', seedKind: 'CLAIMED_KNOWN' },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(trigger.className).not.toMatch(/underline/);
  });

  it('rolls back the underline and shows an error toast when the mutation fails', async () => {
    const { toast } = await import('sonner');
    introduceCardMutate.mockImplementation((_input, opts) => opts.onError());

    renderParagraph('Marta er sykepleier på sykehuset.', [SYKEPLEIER]);
    fireEvent.click(screen.getByRole('button', { name: /look up: sykepleier/i }));
    fireEvent.click(screen.getByRole('button', { name: 'I know this word' }));

    const trigger = screen.getByRole('button', { name: /look up: sykepleier/i });
    expect(trigger.className).toMatch(/underline/);
    expect(toast.error).toHaveBeenCalled();
  });
});
