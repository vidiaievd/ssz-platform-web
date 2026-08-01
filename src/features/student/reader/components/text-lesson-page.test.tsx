import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cn } from '@/lib/utils';
import { enMessages } from '@/lib/i18n/messages';
import type {
  ExerciseWithAnswers,
  Lesson,
  LessonSpanKind,
  LessonTextSpan,
  LessonVariant,
  VocabularyItem,
} from '@/features/content/types';
import type { SrsCardStateEntry } from '@/features/learning';
import type { StudentProfile } from '@/features/profile';

const useLesson = vi.fn();
const useBestLessonVariant = vi.fn();
const useLessonParagraphs = vi.fn();
const useLessonGlossaryMarks = vi.fn();
const useLessonTextSpans = vi.fn();
const useUnitVocabularyItems = vi.fn();
const useLessonListeningStages = vi.fn();
const useExercisesWithAnswers = vi.fn();
const introduceCard = vi.fn();
const useMyStudentProfile = vi.fn();
const useMediaAsset = vi.fn(
  (_id?: string) => ({ data: undefined }) as { data?: { id: string; url: string } },
);

vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return {
    ...actual,
    useLesson: (id: string) => useLesson(id),
    useBestLessonVariant: (...args: unknown[]) => useBestLessonVariant(...args),
    useLessonParagraphs: (...args: unknown[]) => useLessonParagraphs(...args),
    useLessonGlossaryMarks: (...args: unknown[]) => useLessonGlossaryMarks(...args),
    useLessonTextSpans: (...args: unknown[]) => useLessonTextSpans(...args),
    useUnitVocabularyItems: (...args: unknown[]) => useUnitVocabularyItems(...args),
    useLessonListeningStages: (...args: unknown[]) => useLessonListeningStages(...args),
    useExercisesWithAnswers: (...args: unknown[]) => useExercisesWithAnswers(...args),
    useIntroduceCard: () => ({ mutate: introduceCard, isPending: false }),
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
const { useReadingModeStore, TEXT_WIDTH_PX } = await import('../stores/reading-mode-store');
const { useSelectedWordStore } = await import('@/features/learning');
const { ReaderRailProvider, useReaderRailHost } = await import('./reader-rail');

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
  // Global store: without this a word selected by an earlier case leaks into the next.
  useSelectedWordStore.setState({ selected: null });
  useSrsCardStates.mockReturnValue({ data: undefined });
  // Most cases have no author spans; the ones that do override this.
  useLessonTextSpans.mockReturnValue({ data: [], isLoading: false });
  // Most cases have no post-reading check either.
  useLessonListeningStages.mockReturnValue({ data: [], isLoading: false, isError: false });
  useExercisesWithAnswers.mockReturnValue([]);
  introduceCard.mockReset();
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

  it('shows the estimated reading time when the variant has one', () => {
    mockHappyPath();
    useBestLessonVariant.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...VARIANT, estimatedReadingMinutes: 4 },
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByText('4 min read')).toBeInTheDocument();
  });

  it('hides the estimated reading time when the variant has none', () => {
    mockHappyPath();
    renderPage();

    expect(screen.queryByText(/min read/)).not.toBeInTheDocument();
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

    // The coverage figure this block used to assert is gone: it was frozen for
    // the whole session (nothing the reader does in a text moves an SRS state),
    // so it sat at the top of the rail as a number that never changed.
  });
  describe('author text spans', () => {
    // Every seeded Norwegian text opens with a hero image, so paragraph 0 is
    // never renderable and the render index is never the anchor index.
    const HERO_PARAGRAPHS = [
      { target: '![Marta på jobb](media://media-1)', translation: null },
      { target: 'Marta er sykepleier.', translation: 'Marta is a nurse.' },
      { target: 'Hun jobber på sykehuset.', translation: 'She works at the hospital.' },
    ];

    function span(
      paragraphIndex: number,
      paragraph: string,
      selection: string,
      kind: LessonSpanKind,
      refId: string | null = null,
    ): LessonTextSpan {
      const charStart = paragraph.indexOf(selection);
      if (charStart < 0) throw new Error(`fixture does not contain ${JSON.stringify(selection)}`);
      return {
        id: `s-${paragraphIndex}-${charStart}`,
        paragraphIndex,
        charStart,
        charEnd: charStart + selection.length,
        kind,
        refId,
        textSnapshot: selection,
        note: null,
        broken: false,
        brokenReason: null,
        reanchorCandidates: [],
      };
    }

    // Spec 16 §8 obligation 13.
    it('anchors a span by paragraph index, not by position among rendered paragraphs', () => {
      mockHappyPath();
      useLessonParagraphs.mockReturnValue({ data: HERO_PARAGRAPHS });
      useLessonTextSpans.mockReturnValue({
        data: [span(1, HERO_PARAGRAPHS[1]!.target, 'sykepleier', 'vocab', 'v1')],
        isLoading: false,
      });
      renderPage();

      // Paragraph 1 renders first, because the media-only paragraph 0 is
      // filtered out. Reading the span off the render index would put it on
      // "Hun jobber på sykehuset." and nothing would ever report the mistake.
      const marked = screen.getAllByRole('button', { name: /look up/i });
      expect(marked).toHaveLength(1);
      expect(marked[0]!.textContent).toBe('sykepleier');
      expect(marked[0]!.closest('p')?.textContent).toBe('Marta er sykepleier.');
    });

    it('puts a chunk backdrop on the paragraph the author anchored it to', () => {
      mockHappyPath();
      useLessonParagraphs.mockReturnValue({ data: HERO_PARAGRAPHS });
      useLessonTextSpans.mockReturnValue({
        data: [span(2, HERO_PARAGRAPHS[2]!.target, 'på sykehuset', 'chunk')],
        isLoading: false,
      });
      const { container } = renderPage();

      const marked = container.querySelectorAll('[data-span-kind="chunk"]');
      expect(marked).toHaveLength(1);
      expect(marked[0]!.textContent).toBe('på sykehuset');
      expect(marked[0]!.closest('p')?.textContent).toBe('Hun jobber på sykehuset.');
    });

    // "sykepleier" is glossary-marked and occurs in both paragraphs, while the
    // author annotated only the second one.
    const TWICE = [
      { target: 'Marta er sykepleier.', translation: null },
      { target: 'Hun er en dyktig sykepleier.', translation: null },
    ];

    it('keeps the tokenizer running when the only spans are grammar or chunks', () => {
      mockHappyPath();
      useLessonParagraphs.mockReturnValue({ data: TWICE });
      useLessonTextSpans.mockReturnValue({
        data: [span(1, TWICE[1]!.target, 'dyktig sykepleier', 'chunk')],
        isLoading: false,
      });
      renderPage();

      // A chunk has no tokenizer counterpart to collide with, so lexis keeps
      // its fallback and both occurrences stay marked.
      expect(screen.getAllByRole('button', { name: /look up/i })).toHaveLength(2);
    });

    it('switches the tokenizer off for the whole variant, not just the annotated paragraph', () => {
      mockHappyPath();
      useLessonParagraphs.mockReturnValue({ data: TWICE });
      useLessonTextSpans.mockReturnValue({
        data: [span(1, TWICE[1]!.target, 'sykepleier', 'vocab', 'v1')],
        isLoading: false,
      });
      renderPage();

      // One vocab span anywhere in the variant makes spans the sole source of
      // lexis highlighting, so paragraph 0's match is no longer added.
      const marked = screen.getAllByRole('button', { name: /look up/i });
      expect(marked).toHaveLength(1);
      expect(marked[0]!.closest('p')?.textContent).toBe('Hun er en dyktig sykepleier.');
    });

    it('waits for the spans before painting, so the glossing does not flash', () => {
      mockHappyPath();
      useLessonTextSpans.mockReturnValue({ data: undefined, isLoading: true });
      renderPage();

      // Painting first would show every tokenizer match and then rewrite it.
      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    });

    it('offers the highlighting toggle for a text annotated only for grammar', () => {
      mockHappyPath();
      // No vocabulary list at all — the toggle must still reach the backdrops.
      useLessonGlossaryMarks.mockReturnValue({ data: [] });
      useUnitVocabularyItems.mockReturnValue({ data: [] });
      useLessonTextSpans.mockReturnValue({
        data: [span(0, PARAGRAPHS[0]!.target, 'er sykepleier', 'grammar', 'g1')],
        isLoading: false,
      });
      const { container } = renderPage();

      expect(screen.getByRole('radiogroup', { name: /highlighting/i })).toBeInTheDocument();
      expect(container.querySelector('[data-span-kind="grammar"]')).toBeInTheDocument();
    });

    it('withholds the backdrops when glossing is switched off', () => {
      useReadingModeStore.setState({ mode: 'immersive', glossVisibility: 'off' });
      mockHappyPath();
      useLessonTextSpans.mockReturnValue({
        data: [span(1, PARAGRAPHS[1]!.target, 'på sykehuset', 'chunk')],
        isLoading: false,
      });
      const { container } = renderPage();

      expect(container.querySelector('[data-span-kind]')).not.toBeInTheDocument();
    });
  });
  describe('post-reading check', () => {
    const COMP_EXERCISE: ExerciseWithAnswers = {
      id: 'ex-comp',
      templateCode: 'multiple_choice_v1',
      targetLanguage: 'nb',
      content: {
        question: 'Hvor jobber Marta?',
        options: [
          { id: 'a', text: 'På sykehuset' },
          { id: 'b', text: 'På skolen' },
        ],
      },
      expectedAnswers: { correct_option_ids: ['a'] },
    };

    function mockCheck() {
      useLessonListeningStages.mockReturnValue({
        data: [{ exerciseId: 'ex-comp', position: 0, stageType: 'comprehension' }],
        isLoading: false,
        isError: false,
      });
      useExercisesWithAnswers.mockImplementation((ids: string[]) =>
        ids.map((id) => ({ data: id === 'ex-comp' ? COMP_EXERCISE : undefined })),
      );
    }

    it('is absent for a text with no staged exercises', () => {
      mockHappyPath();
      renderPage();

      expect(screen.queryByText('Check your understanding')).not.toBeInTheDocument();
    });

    it('keeps the questions closed until the reader says they have read', () => {
      mockHappyPath();
      mockCheck();
      renderPage();

      expect(screen.getByText('Check your understanding')).toBeInTheDocument();
      expect(screen.getByText('1 question about this text')).toBeInTheDocument();
      expect(screen.queryByText('Hvor jobber Marta?')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Start the check' }));

      expect(screen.getByText('Hvor jobber Marta?')).toBeInTheDocument();
    });

    it('asks about what was read, not what was heard, and offers no audio player', () => {
      mockHappyPath();
      mockCheck();
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Start the check' }));

      expect(screen.getByText('Answer based on what you read.')).toBeInTheDocument();
      expect(screen.queryByText('Answer based on what you heard.')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /play/i })).not.toBeInTheDocument();
    });

    it('sends a missed question to SRS review', () => {
      mockHappyPath();
      mockCheck();
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Start the check' }));
      fireEvent.click(screen.getByRole('radio', { name: 'På skolen' }));
      fireEvent.click(screen.getByRole('button', { name: 'Check answers' }));

      expect(introduceCard).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Finish the check' }));

      expect(introduceCard).toHaveBeenCalledWith({ contentType: 'EXERCISE', contentId: 'ex-comp' });
      expect(screen.getByText('Check complete')).toBeInTheDocument();
    });

    it('does not seed the same question twice when the reader retries', () => {
      mockHappyPath();
      mockCheck();
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Start the check' }));
      fireEvent.click(screen.getByRole('radio', { name: 'På skolen' }));
      fireEvent.click(screen.getByRole('button', { name: 'Check answers' }));
      fireEvent.click(screen.getByRole('button', { name: 'Finish the check' }));
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      fireEvent.click(screen.getByRole('radio', { name: 'På skolen' }));
      fireEvent.click(screen.getByRole('button', { name: 'Check answers' }));
      fireEvent.click(screen.getByRole('button', { name: 'Finish the check' }));

      expect(introduceCard).toHaveBeenCalledTimes(1);
    });

    it('renders the text without a check when the stages fail to load', () => {
      mockHappyPath();
      useLessonListeningStages.mockReturnValue({ data: undefined, isLoading: false, isError: true });
      renderPage();

      expect(screen.getByText(/Marta er/)).toBeInTheDocument();
      expect(screen.queryByText('Check your understanding')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });
  });

  describe('second pass', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('offers a timed re-read once the lesson is already completed', () => {
      mockHappyPath();
      renderPage({ status: 'completed' });

      expect(screen.getByText('Read it again?')).toBeInTheDocument();
    });

    it('does not offer a re-read for a lesson still in progress', () => {
      mockHappyPath();
      renderPage({ status: 'in_progress' });

      expect(screen.queryByText('Read it again?')).not.toBeInTheDocument();
    });

    it('switches off highlighting and starts the stopwatch on accepting the offer', () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockHappyPath();
      renderPage({ status: 'completed' });

      fireEvent.click(screen.getByRole('button', { name: 'Start timed re-read' }));

      expect(useReadingModeStore.getState().glossVisibility).toBe('off');
      expect(screen.queryByText('Read it again?')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      // 5 words ("Marta er sykepleier." + "Hun jobber på sykehuset.") over 3s.
      expect(screen.getByText(/0:03/)).toBeInTheDocument();
    });

    it('does not offer a re-read once highlighting is already off', () => {
      mockHappyPath();
      useReadingModeStore.setState({ mode: 'immersive', glossVisibility: 'off' });
      renderPage({ status: 'completed' });

      expect(screen.queryByText('Read it again?')).not.toBeInTheDocument();
    });
  });
});

describe('TextLessonPage — rail placement', () => {
  const NARRATED: LessonVariant = {
    ...VARIANT,
    bodyMarkdown: `${VARIANT.bodyMarkdown}\n\n[audio:media-1 "Narration"]`,
  };

  /** The shell's rail wiring, reduced to what the page portals into. */
  function RailHarness({ children }: { children: React.ReactNode }) {
    const { value, setContainer, occupied } = useReaderRailHost();
    return (
      <ReaderRailProvider value={value}>
        <div>{children}</div>
        <aside data-testid="rail" ref={setContainer} className={cn(occupied ? 'w-80' : 'hidden')} />
      </ReaderRailProvider>
    );
  }

  function renderInShell() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <RailHarness>
            <TextLessonPage
              lessonId="lesson-1"
              vocabularyListId="list-1"
              unitPosition={4}
              courseTitle="Norsk B1"
              cefrLevel="B1"
            />
          </RailHarness>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
  }

  function setViewportWide(wide: boolean) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: wide,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  }

  afterEach(() => vi.unstubAllGlobals());

  it('puts the narration player in the rail on a wide viewport', () => {
    mockHappyPath();
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: NARRATED, refetch: vi.fn() });
    useMediaAsset.mockReturnValue({ data: { id: 'media-1', url: 'https://cdn.test/n.mp3' } });
    setViewportWide(true);

    renderInShell();

    const rail = screen.getByTestId('rail');
    expect(rail).toContainElement(screen.getByRole('region', { name: 'En vanlig arbeidsdag' }));
  });

  it('falls back to an inline player when the rail is off screen', () => {
    mockHappyPath();
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: NARRATED, refetch: vi.fn() });
    useMediaAsset.mockReturnValue({ data: { id: 'media-1', url: 'https://cdn.test/n.mp3' } });
    setViewportWide(false);

    renderInShell();

    const player = screen.getByRole('region', { name: 'En vanlig arbeidsdag' });
    expect(screen.getByTestId('rail')).not.toContainElement(player);
  });

  it('never mounts the player twice', () => {
    mockHappyPath();
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: NARRATED, refetch: vi.fn() });
    useMediaAsset.mockReturnValue({ data: { id: 'media-1', url: 'https://cdn.test/n.mp3' } });
    setViewportWide(true);

    renderInShell();

    expect(screen.getAllByRole('region', { name: 'En vanlig arbeidsdag' })).toHaveLength(1);
  });

  it('keeps the word card in the rail even with no audio and no coverage', () => {
    mockHappyPath();
    setViewportWide(true);

    renderInShell();

    // The column must not appear and vanish as words are tapped, so the card's
    // empty state holds it open on its own.
    expect(screen.getByTestId('rail').className).toContain('w-80');
    expect(screen.getByText(/Tap an underlined word/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('replaces the empty state with the tapped word', () => {
    mockHappyPath();
    setViewportWide(true);

    renderInShell();
    fireEvent.click(screen.getByText('sykepleier'));

    const rail = screen.getByTestId('rail');
    expect(rail).toContainElement(screen.getByRole('link', { name: /ordbokene\.no/ }));
    expect(screen.queryByText(/Tap an underlined word/)).not.toBeInTheDocument();
  });

  it('keeps the reading controls in the rail, where the prose cannot scroll them away', () => {
    mockHappyPath();
    setViewportWide(true);

    renderInShell();

    const rail = screen.getByTestId('rail');
    expect(rail).toContainElement(screen.getByRole('radiogroup', { name: 'Reading mode' }));
    expect(rail).toContainElement(screen.getByRole('radiogroup', { name: 'Text width' }));
  });

  it('keeps the variable-height word card last, so nothing above it shifts on a lookup', () => {
    mockHappyPath();
    setViewportWide(true);

    renderInShell();

    const settings = screen.getByRole('radiogroup', { name: 'Reading mode' });
    const card = screen.getByText(/Tap an underlined word/);
    // DOM order is the proxy for layout here: with the card last, nothing above
    // it can be pushed down when it grows from a hint into a full paradigm.
    expect(settings.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('still has the settings above the card once a word is chosen', () => {
    mockHappyPath();
    setViewportWide(true);

    renderInShell();
    fireEvent.click(screen.getByText('sykepleier'));

    const settings = screen.getByRole('radiogroup', { name: 'Reading mode' });
    const card = screen.getByRole('link', { name: /ordbokene\.no/ });
    expect(settings.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('drops the previous lesson\'s word when the reader moves on', () => {
    mockHappyPath();
    setViewportWide(true);

    const { unmount } = renderInShell();
    fireEvent.click(screen.getByText('sykepleier'));
    expect(useSelectedWordStore.getState().selected).not.toBeNull();

    // Its context sentence and highlighted form come from this variant; carrying
    // it over would have the rail describing a word from another text.
    unmount();

    expect(useSelectedWordStore.getState().selected).toBeNull();
  });

  it('drops the labels in the rail but keeps them reachable', () => {
    mockHappyPath();
    setViewportWide(true);

    renderInShell();

    const immersive = screen.getByRole('radio', { name: 'Immersive' });
    // Icon-only: the accessible name comes from aria-label, not from text.
    expect(immersive).toHaveTextContent('');
    expect(immersive).toHaveAttribute('title', 'Immersive');
  });

  it('never shows the controls twice', () => {
    mockHappyPath();
    setViewportWide(true);

    renderInShell();

    expect(screen.getAllByRole('radiogroup', { name: 'Reading mode' })).toHaveLength(1);
  });

  it('sends the lookup to the popover, not the panel, when the rail is off screen', () => {
    mockHappyPath();
    setViewportWide(false);

    renderInShell();
    fireEvent.click(screen.getByText('sykepleier'));

    expect(screen.queryByRole('link', { name: /ordbokene\.no/ })).not.toBeInTheDocument();
  });

  it('names the word card in the rail even while a word is showing', () => {
    mockHappyPath();
    setViewportWide(true);

    renderInShell();

    // Every rail block is labelled, so the column reads as a set of named
    // sections rather than as loose controls stacked on a card.
    const rail = screen.getByTestId('rail');
    expect(within(rail).getByRole('heading', { name: /word card/i })).toBeInTheDocument();
    expect(within(rail).getByRole('heading', { name: /reading/i })).toBeInTheDocument();
  });
});

describe('TextLessonPage — reading width', () => {
  it('offers the three widths as a single choice', () => {
    mockHappyPath();
    renderPage();

    const group = screen.getByRole('radiogroup', { name: 'Text width' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
  });

  it('defaults to medium — the strict measure left too much dead space', () => {
    mockHappyPath();
    renderPage();

    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
  });

  it('records the choice as a preference the shell can read back', () => {
    mockHappyPath();
    renderPage();

    fireEvent.click(screen.getByRole('radio', { name: 'Wide' }));

    expect(useReadingModeStore.getState().textWidth).toBe('wide');
    expect(TEXT_WIDTH_PX.wide).toBeGreaterThan(TEXT_WIDTH_PX.medium);
    expect(TEXT_WIDTH_PX.medium).toBeGreaterThan(TEXT_WIDTH_PX.narrow);
  });
});
