import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { AUDIO_DEFAULT, type ExerciseAudio } from '@/lib/shared-kernel/audio';

import { AudioGateScreen, AudioSegmentButton, AudioTranscript } from './audio-parts';
import { ExerciseAudioPlayer } from './exercise-audio-player';
import { useExerciseAudio, type ExerciseAudioEngine } from './use-exercise-audio';

vi.mock('@/features/media', () => ({
  useMediaAsset: (id?: string) => ({
    data: id === undefined ? undefined : { id, url: `https://cdn.test/${id}.mp3` },
    isError: false,
  }),
}));

/*
  A query client, because the engine asks two questions of the network: media-service for
  the clip (mocked above) and, under `source: 'lesson'`, the lesson body the recording is
  referenced from (plan 56 §3.8). Neither is asked for an exercise with no audio — the
  hooks run, and both are handed nothing to look up.
*/
const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

type AudioOverrides = Partial<Omit<ExerciseAudio, 'settings'>> & {
  settings?: Partial<ExerciseAudio['settings']>;
};

const audioOn = (over: AudioOverrides = {}): ExerciseAudio => ({
  ...AUDIO_DEFAULT,
  enabled: true,
  assetId: 'asset-1',
  title: 'Dialog: på legekontoret',
  duration: 96,
  ...over,
  settings: { ...AUDIO_DEFAULT.settings, ...over.settings },
});

/** An engine with nothing behind it: the kernel's rules are tested without a DOM. */
function fakeEngine(over: Partial<ExerciseAudioEngine> = {}): ExerciseAudioEngine {
  return {
    audio: audioOn(),
    segments: {},
    element: null,
    src: 'https://cdn.test/asset-1.mp3',
    state: { pos: 0, playing: false, plays: 0, completed: 0, range: null },
    duration: 96,
    playing: false,
    plays: 0,
    limit: 0,
    exhausted: false,
    heard: false,
    gated: false,
    canPlay: true,
    failed: false,
    loading: false,
    speed: 1,
    toggle: vi.fn(),
    back: vi.fn(),
    seekTo: vi.fn(),
    playRange: vi.fn(),
    cycleSpeed: vi.fn(),
    reset: vi.fn(),
    ...over,
  };
}

describe('ExerciseAudioPlayer', () => {
  it('says what it is doing in text, not only in the animation', () => {
    // The bars are decoration and are hidden from readers; the status line is the
    // announcement (README, "Accessibility").
    wrap(<ExerciseAudioPlayer eng={fakeEngine({ playing: true })} />);
    expect(screen.getByRole('status')).toHaveTextContent('Playing');
  });

  it('refuses the press when the allowance is out, and says why', () => {
    wrap(
      <ExerciseAudioPlayer
        eng={fakeEngine({ exhausted: true, canPlay: false, plays: 2, limit: 2 })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('No listens left');
    expect(screen.getByText('No listens left', { selector: 'span.text-\\[11\\.5px\\]' })).toBeInTheDocument();
  });

  it('counts the listens left when the teacher set a limit', () => {
    wrap(<ExerciseAudioPlayer eng={fakeEngine({ plays: 1, limit: 3 })} />);
    expect(screen.getByText('2 of 3 left')).toBeInTheDocument();
  });

  it('offers a slider only where scrubbing is allowed', () => {
    const seekable = fakeEngine({ audio: audioOn({ settings: { seek: true } }) });
    const { unmount } = wrap(<ExerciseAudioPlayer eng={seekable} />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
    unmount();

    // Not a disabled slider — a control that is not there at all, because the teacher
    // turned it off to make the listen limit mean something.
    wrap(<ExerciseAudioPlayer eng={fakeEngine({ audio: audioOn({ settings: { seek: false } }) })} />);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('scrubs with the arrow keys — the gap the prototype left open', async () => {
    const eng = fakeEngine({
      audio: audioOn({ settings: { seek: true } }),
      state: { pos: 30, playing: false, plays: 1, completed: 0, range: null },
    });
    wrap(<ExerciseAudioPlayer eng={eng} />);

    const slider = screen.getByRole('slider');
    slider.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(eng.seekTo).toHaveBeenCalledWith(35);

    await userEvent.keyboard('{Home}');
    expect(eng.seekTo).toHaveBeenCalledWith(0);
  });
});

describe('AudioGateScreen', () => {
  it('holds the way in until the clip has been heard through once', async () => {
    const onStart = vi.fn();
    const { unmount } = wrap(
      <AudioGateScreen eng={fakeEngine({ gated: true })} onStart={onStart} />,
    );

    const locked = screen.getByRole('button', { name: 'Listen first' });
    expect(locked).toBeDisabled();
    unmount();

    wrap(<AudioGateScreen eng={fakeEngine({ heard: true })} onStart={onStart} />);
    await userEvent.click(screen.getByRole('button', { name: 'To the items' }));
    expect(onStart).toHaveBeenCalled();
  });
});

describe('AudioSegmentButton', () => {
  it('plays only its own slice, and costs nothing', async () => {
    const eng = fakeEngine();
    wrap(<AudioSegmentButton eng={eng} segment={{ start: 22, end: 48 }} />);

    await userEvent.click(screen.getByRole('button', { name: /0:22–0:48/ }));
    expect(eng.playRange).toHaveBeenCalledWith(22, 48);
  });

  it('is not drawn for an item with no timecode', () => {
    const { container } = wrap(<AudioSegmentButton eng={fakeEngine()} segment={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AudioTranscript', () => {
  const words = { transcript: 'Hei, jeg har vondt i halsen.', translation: 'My throat hurts.' };

  it('shows nothing under `never`, whatever arrived', () => {
    const { container } = wrap(
      <AudioTranscript audio={audioOn({ ...words })} revealed delivered={words} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('is readable from the start under `always` — the accommodation path', async () => {
    wrap(
      <AudioTranscript
        audio={audioOn({ ...words, settings: { transcriptWhen: 'always' } })}
        revealed={false}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Transcript' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByText(words.transcript)).toBeInTheDocument();
  });

  it('waits for the server under `after`, and never guesses', async () => {
    const audio = audioOn({ settings: { transcriptWhen: 'after' } });
    // The words are not in the document: the projection withheld them (plan 56 §3.3).
    const { unmount } = wrap(<AudioTranscript audio={audio} revealed={false} />);
    expect(screen.queryByRole('button', { name: 'Transcript' })).not.toBeInTheDocument();
    unmount();

    wrap(<AudioTranscript audio={audio} revealed delivered={words} />);
    await userEvent.click(screen.getByRole('button', { name: 'Transcript' }));
    expect(screen.getByText(words.transcript)).toBeInTheDocument();
  });
});

/*
  The adapter, with a stubbed element. What is being checked is not the rules — those are
  the kernel's and are tested without a DOM — but that this hook drives an element with
  them: a press starts playback, a fragment moves the head, and a hidden runner goes quiet.
*/
describe('useExerciseAudio', () => {
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();

  beforeEach(() => {
    play.mockClear();
    pause.mockClear();
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(play);
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
  });

  function Harness({ content, active = true }: { content: unknown; active?: boolean }) {
    const eng = useExerciseAudio(content, { active });
    return (
      <div>
        {/* Mirrors every real caller: nothing is drawn for an exercise with no audio. */}
        {eng.audio.enabled && <ExerciseAudioPlayer eng={eng} />}
        <button type="button" onClick={() => eng.playRange(10, 20)}>
          fragment
        </button>
        <output data-testid="src">{eng.src ?? 'none'}</output>
        <output data-testid="plays">{eng.plays}</output>
        <output data-testid="gated">{String(eng.gated)}</output>
      </div>
    );
  }

  const document = (over: AudioOverrides = {}) => ({
    questions: [],
    audio: audioOn(over),
  });

  it('starts the element and spends a listen', async () => {
    wrap(<Harness content={document({ settings: { plays: 2 } })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(play).toHaveBeenCalled();
    expect(screen.getByTestId('plays')).toHaveTextContent('1');
  });

  it('plays a fragment without spending one', async () => {
    wrap(<Harness content={document({ settings: { plays: 2 } })} />);

    await userEvent.click(screen.getByRole('button', { name: 'fragment' }));

    expect(play).toHaveBeenCalled();
    expect(screen.getByTestId('plays')).toHaveTextContent('0');
  });

  it('goes quiet when the runner is hidden', async () => {
    // Re-rendered through the same providers it was mounted in: a rerender that dropped
    // one would remount the hook rather than re-run it, which is not what a hidden runner
    // does to a player.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const harness = (active: boolean) => (
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <Harness content={document()} active={active} />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );

    const { rerender } = render(harness(true));
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));

    rerender(harness(false));

    await waitFor(() => expect(pause).toHaveBeenCalled());
  });

  it('locks the items until one full listen, and opens when the clip cannot be played', () => {
    const { unmount } = wrap(<Harness content={document({ settings: { gate: 'first' } })} />);
    expect(screen.getByTestId('gated')).toHaveTextContent('true');
    unmount();

    // A 404 must never leave an exercise unanswerable (BEHAVIOR §11): a `link` source
    // with no URL is the same dead end as a clip that will not load.
    wrap(
      <Harness
        content={document({ source: 'link', url: '', settings: { gate: 'first' } })}
      />,
    );
    expect(screen.getByTestId('gated')).toHaveTextContent('false');
  });

  it('reads a document with no audio as silent, and asks media-service nothing', () => {
    wrap(<Harness content={{ questions: [] }} />);
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
  });

  /*
    `source: 'lesson'` — plan 56 §3.8, phase 6. The document stores a reference and the
    reader turns it into a clip, by reading the `[audio:id]` token out of the lesson body.
    Resolved here rather than in a projection because two services project this block and
    only one of them has lessons.
  */
  describe('borrowing a lesson recording', () => {
    const lessonDoc = () => ({
      audio: audioOn({
        source: 'lesson' as const,
        assetId: '',
        lessonRef: { lessonId: 'lesson-1', variant: 'variant-1' },
      }),
    });

    it('plays the recording the lesson body points at', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 'variant-2', bodyMarkdown: 'Ingen lyd her.' },
          { id: 'variant-1', bodyMarkdown: 'Les teksten.\n\n[audio:media-9 "Opptak"]' },
        ],
      });
      vi.stubGlobal('fetch', fetchMock);

      wrap(<Harness content={lessonDoc()} />);

      await waitFor(() =>
        expect(screen.getByTestId('src')).toHaveTextContent('https://cdn.test/media-9.mp3'),
      );
      expect(fetchMock).toHaveBeenCalledWith('/api/content/lessons/lesson-1/variants');
      vi.unstubAllGlobals();
    });

    it('leaves the exercise playable-looking but silent when the token is gone', async () => {
      // The lesson lost its recording after the exercise borrowed it. That is a clip that
      // cannot be played, which BEHAVIOR §11 says must never lock the learner out.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => [{ id: 'variant-1', bodyMarkdown: 'Teksten, uten opptak.' }],
        }),
      );

      wrap(<Harness content={lessonDoc()} />);

      await waitFor(() => expect(screen.getByTestId('src')).toHaveTextContent('none'));
      vi.unstubAllGlobals();
    });
  });
});
