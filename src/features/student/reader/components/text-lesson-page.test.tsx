import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Lesson, LessonVariant, VocabularyItem } from '@/features/content/types';
import type { SrsCardStateEntry } from '@/features/learning';
import type { StudentProfile } from '@/features/profile';

const useLesson = vi.fn();
const useBestLessonVariant = vi.fn();
const useLessonParagraphs = vi.fn();
const useLessonGlossaryMarks = vi.fn();
const useUnitVocabularyItems = vi.fn();
const useMyStudentProfile = vi.fn();
const useMediaAsset = vi.fn((_id?: string) => ({ data: undefined }));

vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return {
    ...actual,
    useLesson: (id: string) => useLesson(id),
    useBestLessonVariant: (...args: unknown[]) => useBestLessonVariant(...args),
    useLessonParagraphs: (...args: unknown[]) => useLessonParagraphs(...args),
    useLessonGlossaryMarks: (...args: unknown[]) => useLessonGlossaryMarks(...args),
    useUnitVocabularyItems: (...args: unknown[]) => useUnitVocabularyItems(...args),
    useIntroduceCard: () => ({ mutate: vi.fn(), isPending: false }),
  };
});
const useSrsCardStates = vi.fn(() => ({ data: undefined }) as { data?: { states: SrsCardStateEntry[] } });
vi.mock('@/features/learning', async () => {
  const actual = await vi.importActual<typeof import('@/features/learning')>('@/features/learning');
  return { ...actual, useSrsCardStates: (...args: unknown[]) => useSrsCardStates(...(args as [])) };
});

vi.mock('@/features/profile', () => ({ useMyStudentProfile: () => useMyStudentProfile() }));
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

const { TextLessonPage } = await import('./text-lesson-page');
const { useReadingModeStore } = await import('../stores/reading-mode-store');

const LESSON: Lesson = {
  id: 'lesson-1',
  slug: 'en-vanlig-arbeidsdag',
  title: 'En vanlig arbeidsdag',
  targetLanguage: 'nb',
  difficultyLevel: 'B1',
  visibility: 'public',
  ownerUserId: 'u1',
  kind: 'text',
  liveStartsAt: null,
  liveDurationMinutes: null,
  liveJoinUrl: null,
  liveCapacity: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const VARIANT: LessonVariant = {
  id: 'variant-1',
  lessonId: 'lesson-1',
  explanationLanguage: 'en',
  minLevel: 'A1',
  maxLevel: 'C2',
  displayTitle: 'En vanlig arbeidsdag',
  displayDescription: 'A day in the life of a nurse.',
  bodyMarkdown: 'Marta er sykepleier.\n\nHun jobber på sykehuset.',
  status: 'published',
};

const PARAGRAPHS = [
  { target: 'Marta er sykepleier.', translation: 'Marta is a nurse.' },
  { target: 'Hun jobber på sykehuset.', translation: 'She works at the hospital.' },
];

const SYKEPLEIER: VocabularyItem = {
  id: 'v1',
  lemma: 'sykepleier',
  partOfSpeech: 'noun',
  translations: [{ languageCode: 'en', translation: 'nurse' }],
  examples: [],
};

const PROFILE: StudentProfile = {
  id: 'p1',
  userId: 'u1',
  nativeLanguage: 'en',
  targetLanguages: [{ code: 'nb', level: 'B1' }],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function mockHappyPath() {
  useLesson.mockReturnValue({ isLoading: false, isError: false, data: LESSON, refetch: vi.fn() });
  useMyStudentProfile.mockReturnValue({ isLoading: false, isError: false, data: PROFILE, refetch: vi.fn() });
  useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: VARIANT, refetch: vi.fn() });
  useLessonParagraphs.mockReturnValue({ data: PARAGRAPHS });
  useLessonGlossaryMarks.mockReturnValue({ data: [{ id: 'm1', vocabularyItemId: 'v1', occurrenceCount: 1 }] });
  useUnitVocabularyItems.mockReturnValue({ data: [SYKEPLEIER] });
}

function renderPage(overrides: Partial<React.ComponentProps<typeof TextLessonPage>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <TextLessonPage
          lessonId="lesson-1"
          vocabularyListId="list-1"
          unitPosition={4}
          courseTitle="Norsk B1"
          cefrLevel="B1"
          {...overrides}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useReadingModeStore.setState({ mode: 'immersive', glossVisibility: 'unknown' });
  useSrsCardStates.mockReturnValue({ data: undefined });
});

afterEach(() => {
  window.localStorage.clear();
});

describe('TextLessonPage', () => {
  it('shows a loading skeleton while fetching', () => {
    useLesson.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    useLessonParagraphs.mockReturnValue({ data: undefined });
    useLessonGlossaryMarks.mockReturnValue({ data: undefined });
    useUnitVocabularyItems.mockReturnValue({ data: undefined });
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows an error state with retry on failure', () => {
    const refetchLesson = vi.fn();
    useLesson.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch: refetchLesson });
    useMyStudentProfile.mockReturnValue({ isLoading: false, isError: false, data: PROFILE, refetch: vi.fn() });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    useLessonParagraphs.mockReturnValue({ data: undefined });
    useLessonGlossaryMarks.mockReturnValue({ data: undefined });
    useUnitVocabularyItems.mockReturnValue({ data: undefined });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetchLesson).toHaveBeenCalled();
  });

  it('shows an actionable empty state when the profile has no native language yet', () => {
    useLesson.mockReturnValue({ isLoading: false, isError: false, data: LESSON, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...PROFILE, nativeLanguage: null },
      refetch: vi.fn(),
    });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    useLessonParagraphs.mockReturnValue({ data: undefined });
    useLessonGlossaryMarks.mockReturnValue({ data: undefined });
    useUnitVocabularyItems.mockReturnValue({ data: undefined });
    renderPage();
    expect(screen.getByText("This lesson isn't ready for you yet")).toBeInTheDocument();
  });

  it('renders immersive mode by default with a tappable glossary word', () => {
    mockHappyPath();
    renderPage();

    expect(screen.getByText('En vanlig arbeidsdag')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /immersive/i })).toHaveAttribute('aria-checked', 'true');

    const glossWord = screen.getByRole('button', { name: /look up: sykepleier/i });
    fireEvent.click(glossWord);
    expect(screen.getByText('nurse')).toBeInTheDocument();

    // translations hidden until toggled
    expect(screen.queryByText('Marta is a nurse.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show translation/i }));
    expect(screen.getByText('Marta is a nurse.')).toBeInTheDocument();
  });

  it('switches to bilingual mode and shows both columns', () => {
    mockHappyPath();
    renderPage();

    fireEvent.click(screen.getByRole('radio', { name: /bilingual/i }));
    expect(screen.getByText('Marta is a nurse.')).toBeInTheDocument();
    expect(screen.getByText('She works at the hospital.')).toBeInTheDocument();
  });

  it('switches to focus mode and only shows the active paragraph translation', () => {
    mockHappyPath();
    renderPage();

    fireEvent.click(screen.getByRole('radio', { name: /focus/i }));
    expect(screen.getByText('Marta is a nurse.')).toBeInTheDocument();
    expect(screen.queryByText('She works at the hospital.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next paragraph/i }));
    expect(screen.getByText('She works at the hospital.')).toBeInTheDocument();
    expect(screen.queryByText('Marta is a nurse.')).not.toBeInTheDocument();
  });

  it('shows a loading skeleton while the glossary marks are still loading', () => {
    mockHappyPath();
    useLessonGlossaryMarks.mockReturnValue({ data: undefined, isLoading: true });
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders the text without underlines when glossary marks fail to load', () => {
    mockHappyPath();
    useLessonGlossaryMarks.mockReturnValue({ data: undefined, isError: true });
    renderPage();

    expect(screen.getByText('En vanlig arbeidsdag')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /look up: sykepleier/i })).not.toBeInTheDocument();
  });

  describe('without paragraph translations', () => {
    function mockUntranslated() {
      mockHappyPath();
      useLessonParagraphs.mockReturnValue({
        data: PARAGRAPHS.map((p) => ({ ...p, translation: null })),
      });
    }

    it('hides the bilingual mode and the show-translation toggle', () => {
      mockUntranslated();
      renderPage();

      expect(screen.queryByRole('radio', { name: /bilingual/i })).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /immersive/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /focus/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /show translation/i })).not.toBeInTheDocument();
    });

    it('falls back to immersive when the stored mode is bilingual', () => {
      mockUntranslated();
      useReadingModeStore.setState({ mode: 'bilingual' });
      renderPage();

      expect(screen.getByRole('radio', { name: /immersive/i })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('button', { name: /look up: sykepleier/i })).toBeInTheDocument();
      // the bilingual column headers are gone with the mode
      expect(screen.queryByText('Translation')).not.toBeInTheDocument();
    });

    it('keeps focus mode usable', () => {
      mockUntranslated();
      renderPage();

      fireEvent.click(screen.getByRole('radio', { name: /focus/i }));
      expect(screen.getByRole('button', { name: /next paragraph/i })).toBeInTheDocument();
    });
  });

  describe('default reading mode by CEFR level', () => {
    it('starts an A2 student in bilingual mode when they never chose', () => {
      mockHappyPath();
      useReadingModeStore.setState({ mode: null });
      renderPage({ cefrLevel: 'A2' });

      expect(screen.getByRole('radio', { name: /bilingual/i })).toHaveAttribute('aria-checked', 'true');
    });

    it('starts a B1 student in immersive mode when they never chose', () => {
      mockHappyPath();
      useReadingModeStore.setState({ mode: null });
      renderPage({ cefrLevel: 'B1' });

      expect(screen.getByRole('radio', { name: /immersive/i })).toHaveAttribute('aria-checked', 'true');
    });

    it("a manual choice overrides the level default and sticks regardless of level", () => {
      mockHappyPath();
      useReadingModeStore.setState({ mode: null });
      renderPage({ cefrLevel: 'A2' });

      fireEvent.click(screen.getByRole('radio', { name: /immersive/i }));
      expect(useReadingModeStore.getState().mode).toBe('immersive');
      expect(screen.getByRole('radio', { name: /immersive/i })).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('adaptive glossing', () => {
    const word = () => screen.getByRole('button', { name: /look up: sykepleier/i });

    it('glosses normally while the card states are still loading', () => {
      mockHappyPath();
      renderPage();

      expect(word().className).toMatch(/decoration-dotted/);
    });

    it('drops the decoration for a word the reader has retained', () => {
      mockHappyPath();
      useSrsCardStates.mockReturnValue({
        data: { states: [{ contentId: 'v1', state: 'REVIEW', stability: 90, dueAt: '2026-12-01T00:00:00Z' }] },
      });
      renderPage();

      expect(word().className).not.toMatch(/underline/);
    });

    it('marks a word in learning strongly', () => {
      mockHappyPath();
      useSrsCardStates.mockReturnValue({
        data: { states: [{ contentId: 'v1', state: 'LEARNING', stability: 1, dueAt: '2026-08-01T00:00:00Z' }] },
      });
      renderPage();

      expect(word().className).toMatch(/decoration-solid/);
    });

    it('turning glossing off removes every decoration but keeps the word clickable', () => {
      mockHappyPath();
      renderPage();

      fireEvent.click(screen.getByRole('radio', { name: /none/i }));

      expect(useReadingModeStore.getState().glossVisibility).toBe('off');
      expect(word().className).not.toMatch(/underline/);

      fireEvent.click(word());
      expect(screen.getByText('nurse')).toBeInTheDocument();
    });

    it('showing all words ignores the retained state', () => {
      mockHappyPath();
      useSrsCardStates.mockReturnValue({
        data: { states: [{ contentId: 'v1', state: 'REVIEW', stability: 90, dueAt: '2026-12-01T00:00:00Z' }] },
      });
      renderPage();

      fireEvent.click(screen.getByRole('radio', { name: /all words/i }));
      expect(word().className).toMatch(/decoration-dotted/);
    });

    it('reports coverage over the marked words, not over the whole text', () => {
      mockHappyPath();
      useSrsCardStates.mockReturnValue({
        data: { states: [{ contentId: 'v1', state: 'REVIEW', stability: 90, dueAt: '2026-12-01T00:00:00Z' }] },
      });
      renderPage();

      expect(screen.getByText(/you know 100% of the marked words/i)).toBeInTheDocument();
    });

    it('hides coverage until the card states arrive', () => {
      mockHappyPath();
      renderPage();

      expect(screen.queryByText(/of the marked words/i)).not.toBeInTheDocument();
    });
  });
});
