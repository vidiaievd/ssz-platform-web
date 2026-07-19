import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { LessonParagraph } from '@/features/content/types';

vi.mock('../actions/lesson-paragraphs', () => ({ saveParagraphTranslationsAction: vi.fn() }));
vi.mock('../api/use-authoring-lessons', () => ({ useLessonParagraphs: vi.fn() }));

const { ParagraphTranslationsPanel } = await import('./paragraph-translations-panel');
const { saveParagraphTranslationsAction } = await import('../actions/lesson-paragraphs');
const { useLessonParagraphs } = await import('../api/use-authoring-lessons');

function renderPanel(variantId: string | undefined) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ParagraphTranslationsPanel lessonId="lesson-1" variantId={variantId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const PARAGRAPHS: LessonParagraph[] = [
  { target: 'Hei, hvordan har du det?', translation: 'Hi, how are you?' },
  { target: 'Bra, takk.', translation: null },
];

beforeEach(() => {
  vi.mocked(saveParagraphTranslationsAction).mockReset();
  vi.mocked(saveParagraphTranslationsAction).mockResolvedValue({ ok: true, value: undefined } as never);
  vi.mocked(useLessonParagraphs).mockReturnValue({ data: undefined, isLoading: false } as never);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ParagraphTranslationsPanel', () => {
  it('prompts to save the anchor text first when there is no variant yet', () => {
    renderPanel(undefined);
    expect(
      screen.getByText('Save the anchor text first to add paragraph translations.'),
    ).toBeInTheDocument();
  });

  it('renders each paragraph target with its existing translation', () => {
    vi.mocked(useLessonParagraphs).mockReturnValue({ data: PARAGRAPHS, isLoading: false } as never);
    renderPanel('variant-1');

    expect(screen.getByText('Hei, hvordan har du det?')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hi, how are you?')).toBeInTheDocument();
    expect(screen.getByText('Bra, takk.')).toBeInTheDocument();
  });

  it('shows the empty state when the anchor text has no paragraphs', () => {
    vi.mocked(useLessonParagraphs).mockReturnValue({ data: [], isLoading: false } as never);
    renderPanel('variant-1');
    expect(
      screen.getByText('No paragraphs yet — write the anchor text above.'),
    ).toBeInTheDocument();
  });

  it('autosaves edited translations as a full replace, dropping blank rows', async () => {
    vi.mocked(useLessonParagraphs).mockReturnValue({ data: PARAGRAPHS, isLoading: false } as never);
    renderPanel('variant-1');

    fireEvent.change(screen.getByDisplayValue('Hi, how are you?'), {
      target: { value: 'Hello, how are you doing?' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(saveParagraphTranslationsAction).toHaveBeenCalledWith('lesson-1', 'variant-1', [
      { paragraphIndex: 0, translation: 'Hello, how are you doing?' },
    ]);
  });
});
