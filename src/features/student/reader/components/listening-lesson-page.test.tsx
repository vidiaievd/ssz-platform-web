import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ExerciseWithAnswers, Lesson, LessonListeningStage, LessonVariant } from '@/features/content/types';
import type { StudentProfile } from '@/features/profile';

const useLesson = vi.fn();
const useBestLessonVariant = vi.fn();
const useLessonListeningStages = vi.fn();
const useExercisesWithAnswers = vi.fn();
const introduceCardMutate = vi.fn();
const useIntroduceCard = vi.fn(() => ({ mutate: introduceCardMutate }));
const useMyStudentProfile = vi.fn();
const useMediaAsset = vi.fn((_id?: string): { data: { id: string; url: string } | undefined } => ({
  data: undefined,
}));

vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return {
    ...actual,
    useLesson: (id: string) => useLesson(id),
    useBestLessonVariant: (...args: unknown[]) => useBestLessonVariant(...args),
    useLessonListeningStages: (...args: unknown[]) => useLessonListeningStages(...args),
    useExercisesWithAnswers: (ids: string[]) => useExercisesWithAnswers(ids),
    useIntroduceCard: () => useIntroduceCard(),
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

const { ListeningLessonPage } = await import('./listening-lesson-page');

const LESSON: Lesson = {
  id: 'lesson-1',
  slug: 'lytteovelse-arbeidsplassen',
  title: 'Lytteøvelse: arbeidsplassen',
  targetLanguage: 'nb',
  difficultyLevel: 'B1',
  visibility: 'public',
  ownerUserId: 'u1',
  kind: 'audio',
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
  displayTitle: 'Lytteøvelse: arbeidsplassen',
  displayDescription: null,
  bodyMarkdown: '[audio:media-1 "Marta snakker om jobben sin"]',
  status: 'published',
};

const STAGES: LessonListeningStage[] = [
  { exerciseId: 'ex-gap-1', position: 0, stageType: 'gap_fill' },
  { exerciseId: 'ex-comp-1', position: 1, stageType: 'comprehension' },
];

const GAP_EXERCISE: ExerciseWithAnswers = {
  id: 'ex-gap-1',
  templateCode: 'fill_in_blank',
  targetLanguage: 'nb',
  content: {
    text_with_blanks: 'Jeg jobber som ___1___ på sykehuset.',
    word_bank: ['sykepleier', 'lærer', 'kokk'],
  },
  expectedAnswers: { blanks: [{ blank_id: 1, accepted_answers: ['sykepleier'] }] },
};

const COMP_EXERCISE: ExerciseWithAnswers = {
  id: 'ex-comp-1',
  templateCode: 'multiple_choice',
  targetLanguage: 'nb',
  content: {
    question: 'Hva jobber Marta som?',
    options: [
      { id: 'o1', text: 'Lege' },
      { id: 'o2', text: 'Sykepleier' },
      { id: 'o3', text: 'Lærer' },
    ],
  },
  expectedAnswers: { correct_option_ids: ['o2'] },
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
  useLessonListeningStages.mockReturnValue({ isLoading: false, isError: false, data: STAGES, refetch: vi.fn() });
  useExercisesWithAnswers.mockImplementation((ids: string[]) =>
    ids.map((id) => ({ data: id === 'ex-gap-1' ? GAP_EXERCISE : id === 'ex-comp-1' ? COMP_EXERCISE : undefined })),
  );
  useMediaAsset.mockImplementation((id?: string) =>
    id === 'media-1' ? { data: { id: 'media-1', url: 'https://cdn.test/audio.mp3' } } : { data: undefined },
  );
}

function renderPage(overrides: Partial<React.ComponentProps<typeof ListeningLessonPage>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ListeningLessonPage
        lessonId="lesson-1"
        unitPosition={4}
        courseTitle="Norsk B1"
        cefrLevel="B1"
        xpReward={40}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  introduceCardMutate.mockClear();
});

describe('ListeningLessonPage', () => {
  it('shows a loading skeleton while fetching', () => {
    useLesson.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    useLessonListeningStages.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    useExercisesWithAnswers.mockReturnValue([]);
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows an error state with retry on failure', () => {
    const refetchLesson = vi.fn();
    useLesson.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch: refetchLesson });
    useMyStudentProfile.mockReturnValue({ isLoading: false, isError: false, data: PROFILE, refetch: vi.fn() });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    useLessonListeningStages.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    useExercisesWithAnswers.mockReturnValue([]);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetchLesson).toHaveBeenCalled();
  });

  it('does not show gap-fill text during the Listen stage', () => {
    mockHappyPath();
    renderPage();
    expect(screen.getByText('Listen carefully')).toBeInTheDocument();
    expect(screen.queryByText(/Jeg jobber som/)).not.toBeInTheDocument();
  });

  it('runs the full listen → gapfill → comp → done flow, scores, and awards XP', () => {
    mockHappyPath();
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: "I'm ready — start gap-fill" }));

    expect(screen.getByText('Fill the gaps')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'lærer' })); // wrong option
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }));
    expect(screen.getByText('0/1 correct')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next — comprehension' }));

    expect(screen.getByRole('heading', { name: 'Comprehension' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Sykepleier/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish listening training' }));

    expect(screen.getByText('Well done!')).toBeInTheDocument();
    expect(screen.getByText('40 XP')).toBeInTheDocument();
    // the missed gap-fill exercise (wrong answer) is introduced into SRS review
    expect(introduceCardMutate).toHaveBeenCalledWith({ contentType: 'EXERCISE', contentId: 'ex-gap-1' });
    expect(introduceCardMutate).not.toHaveBeenCalledWith({ contentType: 'EXERCISE', contentId: 'ex-comp-1' });
  });

  it('shows the empty state when the profile is not ready', () => {
    useLesson.mockReturnValue({ isLoading: false, isError: false, data: LESSON, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    useLessonListeningStages.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    useExercisesWithAnswers.mockReturnValue([]);
    renderPage();
    expect(screen.getByText("This lesson isn't ready for you yet")).toBeInTheDocument();
  });

  it('shows the no-stages empty state when the lesson has no listening stages', () => {
    useLesson.mockReturnValue({ isLoading: false, isError: false, data: LESSON, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({ isLoading: false, isError: false, data: PROFILE, refetch: vi.fn() });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: VARIANT, refetch: vi.fn() });
    useLessonListeningStages.mockReturnValue({ isLoading: false, isError: false, data: [], refetch: vi.fn() });
    useExercisesWithAnswers.mockReturnValue([]);
    useMediaAsset.mockReturnValue({ data: undefined });
    renderPage();
    expect(screen.getByText('No practice staged yet')).toBeInTheDocument();
  });
});
