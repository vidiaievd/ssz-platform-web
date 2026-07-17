import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Lesson, LessonVariant, LessonVideoCue, VocabularyItem } from '@/features/content/types';
import type { StudentProfile } from '@/features/profile';

const useLesson = vi.fn();
const useBestLessonVariant = vi.fn();
const useLessonVideoCues = vi.fn();
const useLessonGlossaryMarks = vi.fn();
const useUnitVocabularyItems = vi.fn();
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
    useLessonVideoCues: (...args: unknown[]) => useLessonVideoCues(...args),
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

const { VideoLessonPage } = await import('./video-lesson-page');
const { useVideoNotesStore } = await import('../stores/video-notes-store');

const LESSON: Lesson = {
  id: 'lesson-1',
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

const VARIANT: LessonVariant = {
  id: 'variant-1',
  lessonId: 'lesson-1',
  explanationLanguage: 'en',
  minLevel: 'A1',
  maxLevel: 'C2',
  displayTitle: 'Intervju på jobben',
  displayDescription: 'Interview at work.',
  bodyMarkdown: '[video:media-1]',
  status: 'published',
};

const CUES: LessonVideoCue[] = [
  { position: 0, startSeconds: 0, targetLine: 'Hei, kan du fortelle om jobben din?', translationLine: null },
  { position: 1, startSeconds: 10, targetLine: 'Jeg jobber som sykepleier.', translationLine: null },
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
  useLessonVideoCues.mockReturnValue({ data: CUES });
  useLessonGlossaryMarks.mockReturnValue({ data: [{ id: 'm1', vocabularyItemId: 'v1', occurrenceCount: 1 }] });
  useUnitVocabularyItems.mockReturnValue({ data: [SYKEPLEIER] });
  useMediaAsset.mockImplementation((id?: string) =>
    id === 'media-1' ? { data: { id: 'media-1', url: 'https://cdn.test/video.mp4' } } : { data: undefined },
  );
}

function renderPage(overrides: Partial<React.ComponentProps<typeof VideoLessonPage>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <VideoLessonPage
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
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  useVideoNotesStore.setState({ notesByLesson: {} });
  window.localStorage.clear();
});

describe('VideoLessonPage', () => {
  it('shows a loading skeleton while fetching', () => {
    useLesson.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    useMyStudentProfile.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    useBestLessonVariant.mockReturnValue({ isLoading: false, isError: false, data: undefined, refetch: vi.fn() });
    useLessonVideoCues.mockReturnValue({ data: undefined });
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
    useLessonVideoCues.mockReturnValue({ data: undefined });
    useLessonGlossaryMarks.mockReturnValue({ data: undefined });
    useUnitVocabularyItems.mockReturnValue({ data: undefined });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetchLesson).toHaveBeenCalled();
  });

  function findParagraphsWithText(container: HTMLElement, text: string) {
    return [...container.querySelectorAll('p')].filter((p) => p.textContent === text);
  }

  it('renders the player, transcript and notes panel', () => {
    mockHappyPath();
    const { container } = renderPage();

    expect(screen.getByText('Intervju på jobben')).toBeInTheDocument();
    expect(screen.getByText('Transcript')).toBeInTheDocument();
    expect(screen.getByText('My notes')).toBeInTheDocument();
    // the current (first) cue renders both as the on-video overlay and the active transcript line
    expect(findParagraphsWithText(container, 'Hei, kan du fortelle om jobben din?').length).toBe(2);
    // the not-yet-reached second cue renders once, in the transcript only
    expect(findParagraphsWithText(container, 'Jeg jobber som sykepleier.')).toHaveLength(1);
  });

  it('toggles subtitles off and hides the on-video overlay', () => {
    mockHappyPath();
    const { container } = renderPage();

    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 10, writable: true });
    fireEvent.timeUpdate(video);
    expect(findParagraphsWithText(container, 'Jeg jobber som sykepleier.')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /subtitles/i }));
    // still shown once in the transcript, but the overlay copy (duplicate text) should be gone
    expect(findParagraphsWithText(container, 'Jeg jobber som sykepleier.')).toHaveLength(1);
  });

  it('adds a note via the notes panel at the current playback position', () => {
    mockHappyPath();
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Add a note at this moment…'), {
      target: { value: 'blodprøver = blood samples' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));

    expect(screen.getByText('blodprøver = blood samples')).toBeInTheDocument();
  });
});
