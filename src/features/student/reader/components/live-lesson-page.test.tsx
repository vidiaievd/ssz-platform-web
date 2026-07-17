import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Lesson } from '@/features/content/types';

const useLesson = vi.fn();

vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return { ...actual, useLesson: (...args: unknown[]) => useLesson(...args) };
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

const { LiveLessonPage } = await import('./live-lesson-page');

const LESSON: Lesson = {
  id: 'lesson-1',
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

function renderPage(overrides: Partial<React.ComponentProps<typeof LiveLessonPage>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LiveLessonPage lessonId="lesson-1" unitPosition={4} courseTitle="Norsk B1" {...overrides} />
    </NextIntlClientProvider>,
  );
}

describe('LiveLessonPage', () => {
  it('shows a loading skeleton while fetching', () => {
    useLesson.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    renderPage();
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows an error state with retry on failure', () => {
    const refetch = vi.fn();
    useLesson.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders the schedule, join link, and external-session note', () => {
    useLesson.mockReturnValue({ isLoading: false, isError: false, data: LESSON, refetch: vi.fn() });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Samtaletime' })).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();

    const joinLink = screen.getByRole('link', { name: /join session/i });
    expect(joinLink).toHaveAttribute('href', 'https://meet.example.com/samtaletime');
    expect(joinLink).toHaveAttribute('target', '_blank');

    expect(screen.getByText(/happens outside the platform/i)).toBeInTheDocument();
  });

  it('shows the not-scheduled empty state when there is no start date', () => {
    useLesson.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...LESSON, liveStartsAt: null },
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByText('Not scheduled yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /join session/i })).not.toBeInTheDocument();
  });

  it('omits duration/capacity/join-link rows when unset', () => {
    useLesson.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...LESSON, liveDurationMinutes: null, liveCapacity: null, liveJoinUrl: null },
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.queryByText('45 min')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /join session/i })).not.toBeInTheDocument();
  });
});
