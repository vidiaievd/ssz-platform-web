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
  return {
    ...actual,
    useLessonVariants: vi.fn(),
    useLessonCues: vi.fn(),
    useLessonGlossaryMarks: vi.fn(),
  };
});
vi.mock('../api/use-authoring-vocabulary', () => ({
  useAuthoringVocabularyLists: vi.fn(),
  useAuthoringVocabularyItems: vi.fn(),
}));
vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return { ...actual, useLesson: vi.fn(), useUnitVocabularyItems: vi.fn() };
});
// Each sub-panel has its own dedicated test suite — stub here so this file
// doesn't also pull in their server action modules / media hooks.
vi.mock('./video-source-slot', () => ({ VideoSourceSlot: () => null }));
vi.mock('./cue-list-editor', () => ({ CueListEditor: () => null }));
vi.mock('./comprehension-question-row', () => ({ ComprehensionQuestionRow: () => null }));
vi.mock('./video-lesson-preview', () => ({
  VideoLessonPreview: ({ title }: { title: string }) => <div>preview: {title}</div>,
}));
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

const { VideoEditorPane } = await import('./video-editor-pane');
const { updateLessonAction } = await import('../actions/lesson');
const { useLessonVariants, useLessonCues, useLessonGlossaryMarks } = await import(
  '../api/use-authoring-lessons'
);
const { useAuthoringVocabularyLists } = await import('../api/use-authoring-vocabulary');
const { useLesson, useUnitVocabularyItems } = await import('@/features/content');

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
        <VideoEditorPane
          kind="video"
          lessonId="lesson-1"
          lessonTitle="En video om Bergen"
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
        displayTitle: 'En video om Bergen',
        bodyMarkdown: '[video:media-1]',
        status: 'draft',
      },
    ],
    isLoading: false,
  } as never);
  vi.mocked(useLessonCues).mockReturnValue({ data: [], isLoading: false } as never);
  vi.mocked(useLesson).mockReturnValue({ data: undefined, isLoading: false, isError: false } as never);
  vi.mocked(useAuthoringVocabularyLists).mockReturnValue({ data: [] } as never);
  vi.mocked(useUnitVocabularyItems).mockReturnValue({ data: [] } as never);
  vi.mocked(useLessonGlossaryMarks).mockReturnValue({ data: [] } as never);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('VideoEditorPane', () => {
  it('renders the loaded title in both the editor and the live preview', () => {
    renderPane();
    expect(screen.getByDisplayValue('En video om Bergen')).toBeInTheDocument();
    expect(screen.getByText('preview: En video om Bergen')).toBeInTheDocument();
  });

  it('autosaves title edits after the debounce', async () => {
    renderPane();

    fireEvent.change(screen.getByPlaceholderText('e.g. Introduction to grammar'), {
      target: { value: 'En ny tittel' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(updateLessonAction).toHaveBeenCalledWith('lesson-1', 'module-1', 'variant-1', 'A2', {
      title: 'En ny tittel',
      body: '[video:media-1]',
    });
  });
});
