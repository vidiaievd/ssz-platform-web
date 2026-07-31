import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { CourseHomePayload, UnitContentsResult } from '@/features/learning';
import type { Lesson, LessonVariant, VocabularyItem, VocabularyList } from '@/features/content/types';
import type { StudentProfile } from '@/features/profile';

const useCourseHome = vi.fn();
const useUnitContents = vi.fn();
const useUpsertProgress = vi.fn();
const useVocabularyList = vi.fn();
const useUnitVocabularyItems = vi.fn();
const useLesson = vi.fn();
const useBestLessonVariant = vi.fn();
const useLessonParagraphs = vi.fn();
const useLessonGlossaryMarks = vi.fn();
const useLessonTextSpans = vi.fn(() => ({ data: [], isLoading: false }));
const useLessonVideoCues = vi.fn();
const useMyStudentProfile = vi.fn();
const useMediaAsset = vi.fn((_id?: string) => ({ data: undefined }));

vi.mock('@/features/learning', async () => {
  const actual = await vi.importActual<typeof import('@/features/learning')>('@/features/learning');
  return {
    ...actual,
    useCourseHome: () => useCourseHome(),
    useUnitContents: () => useUnitContents(),
    useUpsertProgress: (...args: unknown[]) => useUpsertProgress(...args),
  };
});
vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return {
    ...actual,
    useVocabularyList: (id: string) => useVocabularyList(id),
    useUnitVocabularyItems: (id: string) => useUnitVocabularyItems(id),
    useLesson: (id: string) => useLesson(id),
    useBestLessonVariant: (...args: unknown[]) => useBestLessonVariant(...args),
    useLessonParagraphs: (...args: unknown[]) => useLessonParagraphs(...args),
    useLessonGlossaryMarks: (...args: unknown[]) => useLessonGlossaryMarks(...args),
    useLessonTextSpans: () => useLessonTextSpans(),
    useLessonVideoCues: (...args: unknown[]) => useLessonVideoCues(...args),
    // The text lesson's post-reading check: not what this suite is about, and a
    // real query here would go to the network without a route handler.
    useLessonListeningStages: () => ({ data: [], isLoading: false, isError: false }),
  };
});
// ExercisePage imports this deep hook directly (not via the @/features/content
// barrel), so it must be mocked to avoid a real useQuery without a provider.
vi.mock('@/features/content/api/use-exercise', () => ({
  useExercisesWithAnswers: () => [],
  useExerciseWithAnswers: () => ({
    data: {
      id: 'exercise-1',
      templateCode: 'short_answer',
      targetLanguage: 'nb',
      content: { question: 'Exercise question' },
      expectedAnswers: { reference_answer: 'ref' },
      instructions: null,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/features/profile', () => ({ useMyStudentProfile: () => useMyStudentProfile() }));
vi.mock('@/features/media', () => ({ useMediaAsset: (id?: string) => useMediaAsset(id) }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }));
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

const { ReaderShell } = await import('./reader-shell');

const COURSE_HOME: CourseHomePayload = {
  courseInfo: { id: 'course-1', title: 'Norsk B1', cefrLevel: 'B1', targetLanguage: 'nb', schoolName: 'Nordlys' },
  units: [
    { id: 'u1', position: 1, title: 'Hverdagsliv', status: 'done', completedLessons: 5, totalLessons: 5 },
    { id: 'u2', position: 2, title: 'Arbeid og studier', status: 'active', completedLessons: 1, totalLessons: 3 },
  ],
  levels: [],
  progress: { courseId: 'course-1', totalLessons: 50, completedLessons: 17, percentComplete: 34, modules: [], lessons: [] },
  mastery: { courseId: 'course-1', overallMastery: 0, bySkill: [] },
  srsDueCount: 0,
  srsReviewedToday: 0,
  srsVocabDue: 0,
  srsExerciseDue: 0,
  canDo: { items: [] },
  overdueAssignmentCount: 0,
};

const UNIT_CONTENTS: UnitContentsResult = {
  moduleId: 'u2',
  moduleTitle: 'Arbeid og studier',
  sections: [
    {
      id: 's1',
      title: 'Reinforce & read',
      items: [
        {
          // `exercise` renders ExercisePage (mocked deep hook above); the two
          // chrome tests below use it to verify ReaderShell wiring end to end.
          id: 'item-1',
          contentType: 'EXERCISE',
          contentId: 'exercise-1',
          title: 'En vanlig arbeidsdag',
          lessonKind: null,
          durationMinutes: 8,
          xpReward: 10,
          status: 'in_progress',
        },
        {
          id: 'video-1',
          contentType: 'LESSON',
          contentId: 'lesson-2',
          title: 'Intervju på jobben',
          lessonKind: 'video',
          durationMinutes: 6,
          xpReward: 10,
          status: 'locked',
        },
      ],
    },
  ],
  ungroupedItems: [],
};

const UNIT_CONTENTS_WITH_VOCAB: UnitContentsResult = {
  ...UNIT_CONTENTS,
  sections: [
    {
      id: 's1',
      title: 'Reinforce & read',
      items: [
        {
          id: 'vocab-1',
          contentType: 'VOCABULARY_LIST',
          contentId: 'list-1',
          title: 'Yrker og oppgaver',
          lessonKind: null,
          durationMinutes: null,
          xpReward: null,
          status: 'in_progress',
        },
        ...(UNIT_CONTENTS.sections[0]?.items ?? []),
      ],
    },
  ],
};

const UNIT_CONTENTS_WITH_TEXT: UnitContentsResult = {
  ...UNIT_CONTENTS,
  sections: [
    {
      id: 's1',
      title: 'Reinforce & read',
      items: [
        {
          id: 'text-1',
          contentType: 'LESSON',
          contentId: 'lesson-1',
          title: 'En vanlig arbeidsdag',
          lessonKind: 'text',
          durationMinutes: 8,
          xpReward: 10,
          status: 'in_progress',
        },
      ],
    },
  ],
};

const TEXT_LESSON: Lesson = {
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

const TEXT_VARIANT: LessonVariant = {
  id: 'variant-1',
  lessonId: 'lesson-1',
  explanationLanguage: 'en',
  minLevel: 'A1',
  maxLevel: 'C2',
  displayTitle: 'En vanlig arbeidsdag',
  bodyMarkdown: 'Marta er sykepleier.',
  status: 'published',
};

const VIDEO_LESSON: Lesson = {
  id: 'lesson-2',
  slug: 'intervju-pa-jobben',
  title: 'Intervju på jobben',
  targetLanguage: 'nb',
  difficultyLevel: 'B1',
  visibility: 'public',
  ownerUserId: 'u1',
  kind: 'video',
  liveStartsAt: null,
  liveDurationMinutes: null,
  liveJoinUrl: null,
  liveCapacity: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const VIDEO_VARIANT: LessonVariant = {
  id: 'variant-2',
  lessonId: 'lesson-2',
  explanationLanguage: 'en',
  minLevel: 'A1',
  maxLevel: 'C2',
  displayTitle: 'Intervju på jobben',
  bodyMarkdown: '[video:media-1]',
  status: 'published',
};

const UNIT_CONTENTS_WITH_LIVE: UnitContentsResult = {
  ...UNIT_CONTENTS,
  sections: [
    {
      id: 's1',
      title: 'Reinforce & read',
      items: [
        {
          id: 'live-1',
          contentType: 'LESSON',
          contentId: 'lesson-3',
          title: 'Samtaletime',
          lessonKind: 'live',
          durationMinutes: 30,
          xpReward: 10,
          status: 'in_progress',
        },
      ],
    },
  ],
};

const LIVE_LESSON: Lesson = {
  id: 'lesson-3',
  slug: 'samtaletime',
  title: 'Samtaletime',
  targetLanguage: 'nb',
  difficultyLevel: 'B1',
  visibility: 'public',
  ownerUserId: 'u1',
  kind: 'live',
  liveStartsAt: '2026-02-01T18:00:00Z',
  liveDurationMinutes: 45,
  liveJoinUrl: 'https://meet.example.com/samtaletime',
  liveCapacity: 8,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const STUDENT_PROFILE: StudentProfile = {
  id: 'p1',
  userId: 'u1',
  nativeLanguage: 'en',
  targetLanguages: [{ code: 'nb', level: 'B1' }],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const VOCAB_LIST: VocabularyList = {
  id: 'list-1',
  title: 'Yrker og oppgaver',
  targetLanguage: 'nb',
  createdAt: '2026-01-01T00:00:00Z',
};

const VOCAB_ITEMS: VocabularyItem[] = [
  {
    id: 'v1',
    lemma: 'sykepleier',
    partOfSpeech: 'noun',
    translations: [{ languageCode: 'en', translation: 'nurse' }],
    examples: [],
  },
];

function setup() {
  useCourseHome.mockReturnValue({ data: COURSE_HOME, isLoading: false, isError: false, refetch: vi.fn() });
  useUnitContents.mockReturnValue({ data: UNIT_CONTENTS, isLoading: false, isError: false, refetch: vi.fn() });
}

function renderShell(props: Partial<React.ComponentProps<typeof ReaderShell>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ReaderShell courseId="course-1" unitId="u2" itemId="item-1" {...props}>
          <div>lesson content</div>
        </ReaderShell>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('ReaderShell', () => {
  beforeEach(() => {
    useUpsertProgress.mockReturnValue({ mutate: vi.fn() });
  });

  it('renders the sidebar, topbar, content, and footer nav once data loads', () => {
    setup();
    renderShell();

    expect(screen.getByText('Norsk B1')).toBeInTheDocument();
    // The exercise item renders ExercisePage in the content slot.
    expect(screen.getByText('Exercise question')).toBeInTheDocument();
    expect(screen.getByText('Practice · En vanlig arbeidsdag')).toBeInTheDocument();
  });

  it('shows the locked-next guard in the footer when the next item is locked', () => {
    setup();
    renderShell();

    expect(screen.getByText('Next unlocks after this')).toBeInTheDocument();
  });

  const TEXT_THEN_AVAILABLE: UnitContentsResult = {
    ...UNIT_CONTENTS_WITH_TEXT,
    sections: [
      {
        id: 's1',
        title: 'Reinforce & read',
        items: [
          ...UNIT_CONTENTS_WITH_TEXT.sections[0]!.items,
          { ...UNIT_CONTENTS.sections[0]!.items[0]!, status: 'available' },
        ],
      },
    ],
  };

  it('marks the current item complete when the footer "Next" link is clicked', () => {
    const mutate = vi.fn();
    useCourseHome.mockReturnValue({ data: COURSE_HOME, isLoading: false, isError: false, refetch: vi.fn() });
    useUnitContents.mockReturnValue({
      data: TEXT_THEN_AVAILABLE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useUpsertProgress.mockReturnValue({ mutate });
    useLesson.mockReturnValue({ isLoading: false, isError: false, data: TEXT_LESSON, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({
      isLoading: false,
      isError: false,
      data: STUDENT_PROFILE,
      refetch: vi.fn(),
    });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: TEXT_VARIANT, refetch: vi.fn() });
    useLessonParagraphs.mockReturnValue({ data: [{ target: 'Marta er sykepleier.', translation: 'Marta is a nurse.' }] });
    useLessonGlossaryMarks.mockReturnValue({ data: [] });
    useUnitVocabularyItems.mockReturnValue({ data: [] });

    renderShell({ itemId: 'text-1' });
    fireEvent.click(screen.getByRole('link', { name: /next/i }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'LESSON', contentId: 'lesson-1', completed: true }),
    );
  });

  it('does not re-upsert progress for an already-completed item', () => {
    const mutate = vi.fn();
    const completedTextUnit: UnitContentsResult = {
      ...TEXT_THEN_AVAILABLE,
      sections: [
        {
          id: 's1',
          title: 'Reinforce & read',
          items: [
            { ...TEXT_THEN_AVAILABLE.sections[0]!.items[0]!, status: 'completed' },
            TEXT_THEN_AVAILABLE.sections[0]!.items[1]!,
          ],
        },
      ],
    };
    useCourseHome.mockReturnValue({ data: COURSE_HOME, isLoading: false, isError: false, refetch: vi.fn() });
    useUnitContents.mockReturnValue({ data: completedTextUnit, isLoading: false, isError: false, refetch: vi.fn() });
    useUpsertProgress.mockReturnValue({ mutate });
    useLesson.mockReturnValue({ isLoading: false, isError: false, data: TEXT_LESSON, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({
      isLoading: false,
      isError: false,
      data: STUDENT_PROFILE,
      refetch: vi.fn(),
    });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: TEXT_VARIANT, refetch: vi.fn() });
    useLessonParagraphs.mockReturnValue({ data: [{ target: 'Marta er sykepleier.', translation: 'Marta is a nurse.' }] });
    useLessonGlossaryMarks.mockReturnValue({ data: [] });
    useUnitVocabularyItems.mockReturnValue({ data: [] });

    renderShell({ itemId: 'text-1' });
    fireEvent.click(screen.getByRole('link', { name: /next/i }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows a loading skeleton while queries are pending', () => {
    useCourseHome.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    useUnitContents.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    renderShell();

    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows an error state with retry when a query fails', () => {
    const refetchCourse = vi.fn();
    const refetchUnit = vi.fn();
    useCourseHome.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: refetchCourse });
    useUnitContents.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: refetchUnit });
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetchCourse).toHaveBeenCalledTimes(1);
    expect(refetchUnit).toHaveBeenCalledTimes(1);
  });

  it('renders VocabularyPage (not children) when the active item is a vocabulary list', () => {
    useCourseHome.mockReturnValue({ data: COURSE_HOME, isLoading: false, isError: false, refetch: vi.fn() });
    useUnitContents.mockReturnValue({
      data: UNIT_CONTENTS_WITH_VOCAB,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useVocabularyList.mockReturnValue({ data: VOCAB_LIST, isLoading: false, isError: false, refetch: vi.fn() });
    useUnitVocabularyItems.mockReturnValue({
      data: VOCAB_ITEMS,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderShell({ itemId: 'vocab-1' });

    expect(useVocabularyList).toHaveBeenCalledWith('list-1');
    expect(useUnitVocabularyItems).toHaveBeenCalledWith('list-1');
    expect(screen.getByText('nurse')).toBeInTheDocument();
    expect(screen.queryByText('lesson content')).not.toBeInTheDocument();
  });

  it('renders TextLessonPage (not children) when the active item is a text lesson', () => {
    useCourseHome.mockReturnValue({ data: COURSE_HOME, isLoading: false, isError: false, refetch: vi.fn() });
    useUnitContents.mockReturnValue({
      data: UNIT_CONTENTS_WITH_TEXT,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useLesson.mockReturnValue({ isLoading: false, isError: false, data: TEXT_LESSON, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({
      isLoading: false,
      isError: false,
      data: STUDENT_PROFILE,
      refetch: vi.fn(),
    });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: TEXT_VARIANT, refetch: vi.fn() });
    useLessonParagraphs.mockReturnValue({ data: [{ target: 'Marta er sykepleier.', translation: 'Marta is a nurse.' }] });
    useLessonGlossaryMarks.mockReturnValue({ data: [] });
    useUnitVocabularyItems.mockReturnValue({ data: [] });

    renderShell({ itemId: 'text-1' });

    expect(useLesson).toHaveBeenCalledWith('lesson-1');
    expect(screen.getByText('Marta er sykepleier.')).toBeInTheDocument();
    expect(screen.queryByText('lesson content')).not.toBeInTheDocument();
  });

  it('renders VideoLessonPage (not children) when the active item is a video lesson', () => {
    useCourseHome.mockReturnValue({ data: COURSE_HOME, isLoading: false, isError: false, refetch: vi.fn() });
    useUnitContents.mockReturnValue({ data: UNIT_CONTENTS, isLoading: false, isError: false, refetch: vi.fn() });
    useLesson.mockReturnValue({ isLoading: false, isError: false, data: VIDEO_LESSON, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({
      isLoading: false,
      isError: false,
      data: STUDENT_PROFILE,
      refetch: vi.fn(),
    });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: VIDEO_VARIANT, refetch: vi.fn() });
    useLessonVideoCues.mockReturnValue({ data: [] });
    useLessonGlossaryMarks.mockReturnValue({ data: [] });
    useUnitVocabularyItems.mockReturnValue({ data: [] });

    renderShell({ itemId: 'video-1' });

    expect(useLesson).toHaveBeenCalledWith('lesson-2');
    expect(screen.getByRole('heading', { name: 'Intervju på jobben' })).toBeInTheDocument();
    expect(screen.queryByText('lesson content')).not.toBeInTheDocument();
  });

  it('renders LiveLessonPage (not children) when the active item is a live lesson', () => {
    useCourseHome.mockReturnValue({ data: COURSE_HOME, isLoading: false, isError: false, refetch: vi.fn() });
    useUnitContents.mockReturnValue({
      data: UNIT_CONTENTS_WITH_LIVE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useLesson.mockReturnValue({ isLoading: false, isError: false, data: LIVE_LESSON, refetch: vi.fn() });

    renderShell({ itemId: 'live-1' });

    expect(useLesson).toHaveBeenCalledWith('lesson-3');
    expect(screen.getByRole('heading', { name: 'Samtaletime' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /join session/i })).toHaveAttribute(
      'href',
      'https://meet.example.com/samtaletime',
    );
    expect(screen.queryByText('lesson content')).not.toBeInTheDocument();
  });
});
