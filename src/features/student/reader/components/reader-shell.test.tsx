import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { CourseHomePayload, UnitContentsResult } from '@/features/learning';

const useCourseHome = vi.fn();
const useUnitContents = vi.fn();
const useActivityStreak = vi.fn();

vi.mock('@/features/learning', async () => {
  const actual = await vi.importActual<typeof import('@/features/learning')>('@/features/learning');
  return { ...actual, useCourseHome: () => useCourseHome(), useUnitContents: () => useUnitContents() };
});
vi.mock('@/features/student', () => ({ useActivityStreak: () => useActivityStreak() }));
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
  progress: { courseId: 'course-1', totalLessons: 50, completedLessons: 17, percentComplete: 34, modules: [], lessons: [] },
  mastery: { courseId: 'course-1', overallMastery: 0, bySkill: [] },
  srsDueCount: 0,
  srsStreakDays: 0,
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
          id: 'text-1',
          contentType: 'LESSON',
          contentId: 'lesson-1',
          title: 'En vanlig arbeidsdag',
          lessonKind: 'text',
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

function setup() {
  useCourseHome.mockReturnValue({ data: COURSE_HOME, isLoading: false, isError: false, refetch: vi.fn() });
  useUnitContents.mockReturnValue({ data: UNIT_CONTENTS, isLoading: false, isError: false, refetch: vi.fn() });
  useActivityStreak.mockReturnValue({ data: { currentStreak: 7, longestStreak: 10, totalActiveDays: 20 } });
}

function renderShell(props: Partial<React.ComponentProps<typeof ReaderShell>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ReaderShell courseId="course-1" unitId="u2" itemId="text-1" {...props}>
        <div>lesson content</div>
      </ReaderShell>
    </NextIntlClientProvider>,
  );
}

describe('ReaderShell', () => {
  it('renders the sidebar, topbar, content, and footer nav once data loads', () => {
    setup();
    renderShell();

    expect(screen.getByText('Norsk B1')).toBeInTheDocument();
    expect(screen.getByText('lesson content')).toBeInTheDocument();
    expect(screen.getByText('Reading · En vanlig arbeidsdag')).toBeInTheDocument();
    expect(screen.getByText('7 days streak')).toBeInTheDocument();
  });

  it('shows the locked-next guard in the footer when the next item is locked', () => {
    setup();
    renderShell();

    expect(screen.getByText('Next unlocks after this')).toBeInTheDocument();
  });

  it('shows a loading skeleton while queries are pending', () => {
    useCourseHome.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    useUnitContents.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    useActivityStreak.mockReturnValue({ data: undefined });
    renderShell();

    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows an error state with retry when a query fails', () => {
    const refetchCourse = vi.fn();
    const refetchUnit = vi.fn();
    useCourseHome.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: refetchCourse });
    useUnitContents.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: refetchUnit });
    useActivityStreak.mockReturnValue({ data: undefined });
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetchCourse).toHaveBeenCalledTimes(1);
    expect(refetchUnit).toHaveBeenCalledTimes(1);
  });
});
