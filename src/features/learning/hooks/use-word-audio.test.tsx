// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWordAudio } from './use-word-audio';

/** Lets a single test hand the hook an authored recording. */
const recording = vi.hoisted(() => ({ url: undefined as string | undefined }));
vi.mock('@/features/media', () => ({
  useMediaAsset: (id?: string) => ({ data: id && recording.url ? { url: recording.url } : undefined }),
}));

/** Minimal stand-in for the Web Speech API, with a controllable voice list. */
function installSpeechSynthesis(voices: { lang: string; name: string }[]) {
  const listeners = new Set<EventListener>();
  const synth = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: (_: string, fn: EventListener) => listeners.add(fn),
    removeEventListener: (_: string, fn: EventListener) => listeners.delete(fn),
  };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      lang = '';
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  );
  return { synth, fireVoicesChanged: () => listeners.forEach((fn) => fn(new Event('voiceschanged'))) };
}

/** Stubs the pronunciation endpoint; `null` makes the request fail. */
function mockPronunciationEndpoint(url: string | null) {
  const fetchMock = vi.fn(() =>
    url === null
      ? Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) })
      : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ url, cached: false }) }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  play.mockClear();
  pause.mockClear();
  vi.stubGlobal(
    'Audio',
    class {
      onended: (() => void) | null = null;
      constructor(public src: string) {}
      play = play;
      pause = pause;
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useWordAudio — picking a source', () => {
  it('reports the server as the source when the word has no recording', () => {
    installSpeechSynthesis([]);
    mockPronunciationEndpoint('http://minio/tts/bil.mp3');
    const { result } = renderHook(() => useWordAudio('bil'), { wrapper });

    // No local voice, no recording — and still a usable control, because the
    // clip comes from the platform.
    expect(result.current.source).toBe('server');
  });

  it('survives a browser with no speech synthesis at all', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    mockPronunciationEndpoint('http://minio/tts/bil.mp3');
    const { result } = renderHook(() => useWordAudio('bil'), { wrapper });

    expect(result.current.source).toBe('server');
    expect(() => result.current.play()).not.toThrow();
  });
});

describe('useWordAudio — playing', () => {
  it('fetches the server clip on first tap and plays it', async () => {
    installSpeechSynthesis([]);
    const fetchMock = mockPronunciationEndpoint('http://minio/tts/hus.mp3');
    const { result } = renderHook(() => useWordAudio('hus', undefined, 'nb'), { wrapper });

    await act(async () => {
      result.current.play();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/media/pronunciation',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'hus', lang: 'nb' }) }),
    );
    await waitFor(() => expect(play).toHaveBeenCalled());
  });

  it('reuses the fetched clip on later taps instead of asking again', async () => {
    installSpeechSynthesis([]);
    const fetchMock = mockPronunciationEndpoint('http://minio/tts/gate.mp3');
    const { result } = renderHook(() => useWordAudio('gate', undefined, 'nb'), { wrapper });

    await act(async () => {
      result.current.play();
    });
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.play();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('falls back to a local voice when the server cannot be reached', async () => {
    const { synth } = installSpeechSynthesis([{ lang: 'nb-NO', name: 'Norsk' }]);
    mockPronunciationEndpoint(null);
    const { result } = renderHook(() => useWordAudio('stillingsannonse', undefined, 'nb-NO'), {
      wrapper,
    });

    await act(async () => {
      result.current.play();
    });

    await waitFor(() => expect(synth.speak).toHaveBeenCalled());
    const utterance = synth.speak.mock.calls[0]?.[0] as { text: string; lang: string };
    expect(utterance.text).toBe('stillingsannonse');
    expect(utterance.lang).toBe('nb-NO');
  });

  it('stays silent when the server is down and the browser has no voice', async () => {
    const { synth } = installSpeechSynthesis([{ lang: 'en-US', name: 'English' }]);
    mockPronunciationEndpoint(null);
    const { result } = renderHook(() => useWordAudio('bil', undefined, 'nb'), { wrapper });

    await act(async () => {
      result.current.play();
    });

    expect(synth.speak).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    // The failed attempt must not leave the button spinning forever.
    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  it('plays an authored recording directly, without touching the endpoint', async () => {
    installSpeechSynthesis([]);
    const fetchMock = mockPronunciationEndpoint('http://minio/tts/unused.mp3');
    recording.url = 'http://minio/recordings/veileder.mp3';

    const { result } = renderHook(() => useWordAudio('veileder', 'media-1', 'nb'), { wrapper });

    expect(result.current.source).toBe('recording');
    await act(async () => {
      result.current.play();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalled();
    recording.url = undefined;
  });
});
