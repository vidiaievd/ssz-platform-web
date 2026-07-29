import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Lesson, LessonVariant, VocabularyItem } from '@/features/content/types';
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
  };
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
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <TextLessonPage
        lessonId="lesson-1"
        vocabularyListId="list-1"
        unitPosition={4}
        courseTitle="Norsk B1"
        cefrLevel="B1"
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  useReadingModeStore.setState({ mode: 'immersive' });
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
});
