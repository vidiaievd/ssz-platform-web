import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { LessonVideoCue } from '@/features/content/types';

vi.mock('../actions/lesson-cues', () => ({ saveLessonCuesAction: vi.fn() }));
vi.mock('../api/use-authoring-lessons', () => ({ useLessonCues: vi.fn() }));

const { CueListEditor } = await import('./cue-list-editor');
const { saveLessonCuesAction } = await import('../actions/lesson-cues');
const { useLessonCues } = await import('../api/use-authoring-lessons');

function renderEditor(variantId: string | undefined) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CueListEditor lessonId="lesson-1" variantId={variantId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function clickSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Save cues' }));
  await act(async () => {
    await Promise.resolve();
  });
}

const CUES: LessonVideoCue[] = [
  { position: 0, startSeconds: 0, targetLine: 'Hei!', translationLine: 'Hi!' },
  { position: 1, startSeconds: 3.5, targetLine: 'Hvordan har du det?', translationLine: null },
];

beforeEach(() => {
  vi.mocked(saveLessonCuesAction).mockReset();
  vi.mocked(saveLessonCuesAction).mockResolvedValue({ ok: true, value: undefined } as never);
  vi.mocked(useLessonCues).mockReturnValue({ data: undefined, isLoading: false } as never);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CueListEditor', () => {
  it('prompts to add a video source first when there is no variant yet', () => {
    renderEditor(undefined);
    expect(screen.getByText('Add a video source before adding cues.')).toBeInTheDocument();
  });

  it('renders each existing cue', () => {
    vi.mocked(useLessonCues).mockReturnValue({ data: CUES, isLoading: false } as never);
    renderEditor('variant-1');

    expect(screen.getByDisplayValue('Hei!')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hi!')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hvordan har du det?')).toBeInTheDocument();
  });

  it('shows the empty state when there are no cues yet', () => {
    vi.mocked(useLessonCues).mockReturnValue({ data: [], isLoading: false } as never);
    renderEditor('variant-1');
    expect(
      screen.getByText('No cues yet — add one to start building the transcript.'),
    ).toBeInTheDocument();
  });

  it('does not reach the server until save is pressed', async () => {
    vi.mocked(useLessonCues).mockReturnValue({ data: CUES, isLoading: false } as never);
    renderEditor('variant-1');

    fireEvent.change(screen.getByDisplayValue('Hei!'), { target: { value: 'Hallo!' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(saveLessonCuesAction).not.toHaveBeenCalled();
  });

  it('saves an edited cue as a full replace', async () => {
    vi.mocked(useLessonCues).mockReturnValue({ data: CUES, isLoading: false } as never);
    renderEditor('variant-1');

    fireEvent.change(screen.getByDisplayValue('Hei!'), { target: { value: 'Hallo!' } });
    await clickSave();

    expect(saveLessonCuesAction).toHaveBeenCalledWith('lesson-1', 'variant-1', [
      { position: 0, startSeconds: 0, targetLine: 'Hallo!', translationLine: 'Hi!' },
      {
        position: 1,
        startSeconds: 3.5,
        targetLine: 'Hvordan har du det?',
        translationLine: undefined,
      },
    ]);
  });

  it('adds a new cue row and saves it once filled in', async () => {
    vi.mocked(useLessonCues).mockReturnValue({ data: [], isLoading: false } as never);
    renderEditor('variant-1');

    fireEvent.click(screen.getByRole('button', { name: 'Add cue' }));
    fireEvent.change(screen.getByLabelText('Target line'), { target: { value: 'Ha det!' } });

    await clickSave();

    expect(saveLessonCuesAction).toHaveBeenCalledWith('lesson-1', 'variant-1', [
      { position: 0, startSeconds: 0, targetLine: 'Ha det!', translationLine: undefined },
    ]);
  });

  it('removes a cue row and saves the remaining ones, dropping blank rows', async () => {
    vi.mocked(useLessonCues).mockReturnValue({ data: CUES, isLoading: false } as never);
    renderEditor('variant-1');

    fireEvent.click(screen.getByRole('button', { name: 'Remove cue 1' }));

    await clickSave();

    expect(saveLessonCuesAction).toHaveBeenCalledWith('lesson-1', 'variant-1', [
      {
        position: 0,
        startSeconds: 3.5,
        targetLine: 'Hvordan har du det?',
        translationLine: undefined,
      },
    ]);
  });
});
