import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container } from '@/features/content/types';

vi.mock('../actions/lesson', () => ({ updateLessonAction: vi.fn() }));
vi.mock('../api/use-authoring-lessons', async () => {
  const actual = await vi.importActual<typeof import('../api/use-authoring-lessons')>(
    '../api/use-authoring-lessons',
  );
  return { ...actual, useLessonVariants: vi.fn() };
});
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

const { TextEditorPane } = await import('./text-editor-pane');
const { updateLessonAction } = await import('../actions/lesson');
const { useLessonVariants } = await import('../api/use-authoring-lessons');

const CONTAINER: Container = {
  id: 'module-1',
  slug: 'module-1',
  title: 'Samfunn og kultur',
  containerType: 'module',
  targetLanguage: 'no',
  difficultyLevel: 'A2',
  visibility: 'public',
  accessTier: 'free_within_school',
  ownerUserId: 'user-1',
  createdAt: '',
  updatedAt: '',
};

function renderPane() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <TextEditorPane
          kind="text"
          lessonId="lesson-1"
          lessonTitle="En vanlig arbeidsdag"
          state="draft"
          container={CONTAINER}
          backHref="/school/my-school/content/course-1"
          publishSlot={null}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(updateLessonAction).mockReset();
  vi.mocked(updateLessonAction).mockResolvedValue({ ok: true, value: {} } as never);
  vi.mocked(useLessonVariants).mockReturnValue({
    data: [
      {
        id: 'variant-1',
        lessonId: 'lesson-1',
        explanationLanguage: 'en',
        minLevel: 'A2',
        maxLevel: 'A2',
        displayTitle: 'En vanlig arbeidsdag',
        bodyMarkdown: 'Marta begynner arbeidsdagen klokka sju.',
        status: 'draft',
      },
    ],
    isLoading: false,
  } as never);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TextEditorPane', () => {
  it('renders the loaded body in both the editor and the live preview', () => {
    renderPane();
    expect(screen.getByDisplayValue('Marta begynner arbeidsdagen klokka sju.')).toBeInTheDocument();
    expect(screen.getByText('Marta begynner arbeidsdagen klokka sju.')).toBeInTheDocument();
  });

  it('autosaves body edits after the debounce and reflects them in the preview', async () => {
    renderPane();

    fireEvent.change(screen.getByPlaceholderText('Write lesson content in Markdown…'), {
      target: { value: 'Nytt avsnitt her.' },
    });

    expect(screen.getByText('Nytt avsnitt her.')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(updateLessonAction).toHaveBeenCalledWith(
      'lesson-1',
      'module-1',
      'variant-1',
      'A2',
      { title: 'En vanlig arbeidsdag', body: 'Nytt avsnitt her.' },
    );
  });
});
