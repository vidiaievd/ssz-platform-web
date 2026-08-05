import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container } from '@/features/content/types';

vi.mock('../actions/lesson', () => ({ updateLiveLessonAction: vi.fn() }));
vi.mock('@/features/content', async () => {
  const actual = await vi.importActual<typeof import('@/features/content')>('@/features/content');
  return { ...actual, useLesson: vi.fn() };
});
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { LiveEditorPane } = await import('./live-editor-pane');
const { updateLiveLessonAction } = await import('../actions/lesson');
const { useLesson } = await import('@/features/content');

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
        <LiveEditorPane
          kind="live"
          lessonId="lesson-1"
          lessonTitle="Samtalegruppe: på jobben"
          state="draft"
          isLive={false}
          container={CONTAINER}
          backHref="/school/my-school/content/course-1"
          publishSlot={null}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(updateLiveLessonAction).mockReset();
  vi.mocked(updateLiveLessonAction).mockResolvedValue({ ok: true, value: undefined } as never);
  vi.mocked(useLesson).mockReturnValue({
    data: {
      id: 'lesson-1',
      slug: null,
      title: 'Samtalegruppe: på jobben',
      targetLanguage: 'no',
      difficultyLevel: 'A2',
      visibility: 'public',
      ownerUserId: 'user-1',
      kind: 'live',
      liveStartsAt: '2026-09-18T16:00:00.000Z',
      liveDurationMinutes: 60,
      liveJoinUrl: 'https://meet.ssz.app/norsk-2b',
      liveCapacity: 12,
      createdAt: '',
      updatedAt: '',
    },
    isLoading: false,
  } as never);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LiveEditorPane', () => {
  it('renders the loaded schedule fields and preview', () => {
    renderPane();
    expect(screen.getByDisplayValue('Samtalegruppe: på jobben')).toBeInTheDocument();
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://meet.ssz.app/norsk-2b')).toBeInTheDocument();
    expect(
      screen.getByText('https://meet.ssz.app/norsk-2b', { selector: 'span' }),
    ).toBeInTheDocument();
  });

  it('saves schedule edits when save is pressed', async () => {
    renderPane();

    fireEvent.change(screen.getByLabelText('Capacity'), { target: { value: '20' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(updateLiveLessonAction).toHaveBeenCalledWith(
      'lesson-1',
      'module-1',
      expect.objectContaining({ liveCapacity: 20 }),
    );
  });

  it('toggles the visual-only options without saving', async () => {
    renderPane();

    const recordingToggle = screen.getByLabelText('Publish recording after class');
    expect(recordingToggle).toHaveAttribute('data-state', 'checked');

    fireEvent.click(recordingToggle);
    expect(recordingToggle).toHaveAttribute('data-state', 'unchecked');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(updateLiveLessonAction).not.toHaveBeenCalled();
  });
});
