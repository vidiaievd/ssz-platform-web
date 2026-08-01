// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWordAudio } from './use-word-audio';

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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no media service in this test'))));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useWordAudio — picking a source', () => {
  it('reports none when the browser has no voice for the language', () => {
    installSpeechSynthesis([{ lang: 'en-US', name: 'English' }]);
    const { result } = renderHook(() => useWordAudio('bil'), { wrapper });

    expect(result.current.source).toBe('none');
  });

  it('accepts a no-NO voice for a nb-NO word — Norwegian is tagged three ways', () => {
    installSpeechSynthesis([{ lang: 'no-NO', name: 'Norsk' }]);
    const { result } = renderHook(() => useWordAudio('bil'), { wrapper });

    expect(result.current.source).toBe('synthesis');
  });

  it('accepts an exact nb match', () => {
    installSpeechSynthesis([{ lang: 'nb', name: 'Bokmål' }]);
    const { result } = renderHook(() => useWordAudio('bil'), { wrapper });

    expect(result.current.source).toBe('synthesis');
  });

  it('picks up voices that only arrive with the voiceschanged event', async () => {
    const voices: { lang: string; name: string }[] = [];
    const { fireVoicesChanged } = installSpeechSynthesis(voices);

    const { result } = renderHook(() => useWordAudio('bil'), { wrapper });
    // Chrome's first getVoices() is empty — the button must not settle on 'none'.
    expect(result.current.source).toBe('none');

    voices.push({ lang: 'nb-NO', name: 'Norsk' });
    act(() => fireVoicesChanged());

    await waitFor(() => expect(result.current.source).toBe('synthesis'));
  });

  it('survives a browser with no speech synthesis at all', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    const { result } = renderHook(() => useWordAudio('bil'), { wrapper });

    expect(result.current.source).toBe('none');
    expect(() => result.current.play()).not.toThrow();
  });
});

describe('useWordAudio — speaking', () => {
  it('cancels the queue before speaking, so repeated taps do not stack up', () => {
    const { synth } = installSpeechSynthesis([{ lang: 'nb-NO', name: 'Norsk' }]);
    const { result } = renderHook(() => useWordAudio('bil'), { wrapper });

    act(() => result.current.play());
    act(() => result.current.play());

    expect(synth.cancel).toHaveBeenCalledTimes(2);
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });

  it('speaks the word with the requested language', () => {
    const { synth } = installSpeechSynthesis([{ lang: 'nb-NO', name: 'Norsk' }]);
    const { result } = renderHook(() => useWordAudio('stillingsannonse'), { wrapper });

    act(() => result.current.play());

    const utterance = synth.speak.mock.calls[0]?.[0] as { text: string; lang: string };
    expect(utterance.text).toBe('stillingsannonse');
    expect(utterance.lang).toBe('nb-NO');
  });

  it('clears the playing flag when the utterance ends', () => {
    const { synth } = installSpeechSynthesis([{ lang: 'nb-NO', name: 'Norsk' }]);
    const { result } = renderHook(() => useWordAudio('bil'), { wrapper });

    act(() => result.current.play());
    expect(result.current.playing).toBe(true);

    const utterance = synth.speak.mock.calls[0]?.[0] as { onend: (() => void) | null };
    act(() => utterance.onend?.());

    expect(result.current.playing).toBe(false);
  });

  it('stops speaking when the card moves to another word', () => {
    const { synth } = installSpeechSynthesis([{ lang: 'nb-NO', name: 'Norsk' }]);
    const { result, rerender } = renderHook(({ word }) => useWordAudio(word), {
      wrapper,
      initialProps: { word: 'bil' },
    });

    act(() => result.current.play());
    synth.cancel.mockClear();

    rerender({ word: 'hus' });

    expect(synth.cancel).toHaveBeenCalled();
    expect(result.current.playing).toBe(false);
  });
});
