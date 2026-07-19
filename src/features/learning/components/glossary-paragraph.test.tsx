import { render, screen, fireEvent } from '@testing-library/react';
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
});
