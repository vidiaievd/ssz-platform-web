import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { VocabularyItem } from '@/features/content/types';
import { buildGlossaryIndex } from '../lib/tokenize-glossary';
import { GlossIntensityProvider } from './gloss-intensity-provider';
import type { GlossIntensity } from '../lib/gloss-intensity';

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

function renderParagraph(
  text: string,
  items: VocabularyItem[],
  cefrLevel?: string,
  intensity?: GlossIntensity,
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const paragraph = (
    <GlossaryParagraph text={text} glossary={buildGlossaryIndex(items)} cefrLevel={cefrLevel} />
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {intensity ? (
          <GlossIntensityProvider resolve={() => intensity}>{paragraph}</GlossIntensityProvider>
        ) : (
          paragraph
        )}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('GlossaryParagraph', () => {
  afterEach(() => {
    introduceCardMutate.mockReset();
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

  it('introduces the SRS card as claimed-known when "I know this word" is clicked', () => {
    renderParagraph('Marta er sykepleier på sykehuset.', [SYKEPLEIER]);

    fireEvent.click(screen.getByRole('button', { name: /look up: sykepleier/i }));
    fireEvent.click(screen.getByRole('button', { name: 'I know this word' }));

    // The underline now fades from refetched card states, so the mutation must
    // invalidate them rather than flip local state.
    expect(introduceCardMutate).toHaveBeenCalledWith(
      { contentType: 'VOCABULARY_WORD', contentId: 'v1', seedKind: 'CLAIMED_KNOWN' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('decorates a word according to the gloss intensity in context', () => {
    const { unmount } = renderParagraph('Marta er sykepleier på sykehuset.', [SYKEPLEIER], undefined, 'strong');
    expect(screen.getByRole('button', { name: /look up: sykepleier/i }).className).toMatch(
      /decoration-solid/,
    );
    unmount();

    renderParagraph('Marta er sykepleier på sykehuset.', [SYKEPLEIER], undefined, 'muted');
    expect(screen.getByRole('button', { name: /look up: sykepleier/i }).className).toMatch(
      /decoration-dotted/,
    );
  });

  it('keeps an undecorated word clickable', () => {
    renderParagraph('Marta er sykepleier på sykehuset.', [SYKEPLEIER], undefined, 'none');

    const trigger = screen.getByRole('button', { name: /look up: sykepleier/i });
    expect(trigger.className).not.toMatch(/underline/);

    fireEvent.click(trigger);
    expect(screen.getByText('nurse')).toBeInTheDocument();
  });

  it('falls back to the normal underline with no intensity provider', () => {
    renderParagraph('Marta er sykepleier på sykehuset.', [SYKEPLEIER]);
    expect(screen.getByRole('button', { name: /look up: sykepleier/i }).className).toMatch(
      /decoration-dotted/,
    );
  });

  it('shows the translation below B2', () => {
    renderParagraph('Marta er sykepleier på sykehuset.', [SYKEPLEIER], 'B1');
    fireEvent.click(screen.getByRole('button', { name: /look up: sykepleier/i }));
    expect(screen.getByText('nurse')).toBeInTheDocument();
  });

  it('shows the target-language definition at B2+ when one is authored', () => {
    const withDefinition: VocabularyItem = {
      ...SYKEPLEIER,
      translations: [{ languageCode: 'en', translation: 'nurse', definition: 'person who cares for the sick' }],
    };
    renderParagraph('Marta er sykepleier på sykehuset.', [withDefinition], 'C1');
    fireEvent.click(screen.getByRole('button', { name: /look up: sykepleier/i }));
    expect(screen.getByText('person who cares for the sick')).toBeInTheDocument();
    expect(screen.queryByText('nurse')).not.toBeInTheDocument();
  });

  it('falls back to the translation at B2+ when no definition is authored', () => {
    renderParagraph('Marta er sykepleier på sykehuset.', [SYKEPLEIER], 'C1');
    fireEvent.click(screen.getByRole('button', { name: /look up: sykepleier/i }));
    expect(screen.getByText('nurse')).toBeInTheDocument();
  });

  it('keeps the underline and shows an error toast when the mutation fails', async () => {
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
