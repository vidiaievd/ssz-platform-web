import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_RECORDING, type RecorderConfig } from '@/lib/shared-kernel/read-aloud';

import { bandsOf, failureOf } from './browser-recorder';
import { createMockRecorder, type MockRecorder } from './mock-recorder';
import { bucketPeaks, METER_BANDS } from './port';
import { LEVEL_MS, useRecorder, type CapturedTake } from './use-recorder';

function config(over: Partial<RecorderConfig['recording']> = {}, prep = 2): RecorderConfig {
  return {
    prompts: [
      { id: 'p1', minSeconds: 1, maxSeconds: 5, prepSeconds: prep },
      { id: 'p2', minSeconds: 1, maxSeconds: 5, prepSeconds: prep },
    ],
    recording: { ...DEFAULT_RECORDING, ...over },
  };
}

/** Let the port's promises settle inside `act`. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useRecorder', () => {
  let port: MockRecorder;

  beforeEach(() => {
    vi.useFakeTimers();
    port = createMockRecorder();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:take'), revokeObjectURL: vi.fn() }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens the microphone on the level check and passes it on what it hears', async () => {
    const { result } = renderHook(() => useRecorder({ config: config(), port }));
    expect(result.current.state.phase).toBe('mic');
    await flush();
    expect(port.calls.open).toBeGreaterThanOrEqual(1);

    port.hear(0.5);
    await advance(LEVEL_MS * 4);
    expect(result.current.levels).toHaveLength(METER_BANDS);
    expect(result.current.levels[0]).toBe(0.5);
    expect(result.current.state.micHeardMs).toBeGreaterThanOrEqual(300);

    act(() => result.current.ready());
    expect(result.current.state.phase).toBe('idle');
    // Nothing listens in idle: the meter rests.
    expect(result.current.levels.every((v) => v === 0)).toBe(true);
  });

  it('runs a whole take: prep, countdown, recording, the bytes back to the kernel', async () => {
    const captured: CapturedTake[] = [];
    const { result } = renderHook(() =>
      useRecorder({
        config: config({ micCheck: false, countdown: true }),
        port,
        onCaptured: (t) => captured.push(t),
      }),
    );
    act(() => result.current.begin());
    await flush();
    expect(result.current.state.phase).toBe('prep');

    await advance(2000);
    expect(result.current.state.phase).toBe('count');
    await advance(3000);
    expect(result.current.state.phase).toBe('rec');
    expect(port.calls.start).toBe(1);

    port.nextTakeSeconds(2.4);
    await advance(2000);
    act(() => result.current.stop());
    await flush();

    expect(result.current.state.phase).toBe('review');
    const take = result.current.state.takes['p1']?.[0];
    expect(take).toMatchObject({ n: 1, seconds: 2.4, ref: 'blob:take', upload: 'pending' });
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ itemId: 'p1', n: 1, url: 'blob:take' });
  });

  it('stops by itself at the prompt maximum', async () => {
    const { result } = renderHook(() =>
      useRecorder({ config: config({ micCheck: false, countdown: false }, 0), port }),
    );
    act(() => result.current.begin());
    await flush();
    expect(result.current.state.phase).toBe('rec');
    port.nextTakeSeconds(5);
    await advance(5000);
    await flush();
    expect(port.calls.stop).toBe(1);
    expect(result.current.state.phase).toBe('review');
  });

  it('an interruption mid-take spends no take', async () => {
    const { result } = renderHook(() =>
      useRecorder({ config: config({ micCheck: false, countdown: false }, 0), port }),
    );
    act(() => result.current.begin());
    await flush();
    await advance(1000);

    act(() => port.interrupt('ended'));
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.state.notice).toBe('interrupted');
    expect(result.current.state.takes['p1']).toBeUndefined();
    expect(port.calls.cancel).toBe(1);

    // The stream is gone; the next take opens a new one.
    const opens = port.calls.open;
    act(() => result.current.begin());
    await flush();
    expect(port.calls.open).toBe(opens + 1);
    expect(result.current.state.phase).toBe('rec');
  });

  it('a refused microphone is its own state, and «Prøv igjen» asks again', async () => {
    port.openWith('denied');
    const { result } = renderHook(() => useRecorder({ config: config(), port }));
    await flush();
    expect(result.current.state.phase).toBe('denied');

    port.openWith('ok');
    act(() => result.current.retryMic());
    await flush();
    expect(result.current.state.phase).toBe('mic');
  });

  it('a missing device without the level check surfaces on «Start»', async () => {
    port.openWith('noDevice');
    const { result } = renderHook(() => useRecorder({ config: config({ micCheck: false }), port }));
    act(() => result.current.begin());
    await flush();
    expect(result.current.state.phase).toBe('noDevice');
  });

  it('draws and never opens anything without a port', async () => {
    const { result } = renderHook(() => useRecorder({ config: config(), port: null }));
    act(() => result.current.begin());
    await flush();
    expect(result.current.state.phase).toBe('mic');
  });

  it('releases the microphone on unmount', () => {
    const { unmount } = renderHook(() => useRecorder({ config: config(), port }));
    unmount();
    expect(port.calls.close).toBeGreaterThanOrEqual(1);
  });
});

describe('recorder helpers', () => {
  it('bucketPeaks keeps the loudest sample of each slice', () => {
    expect(bucketPeaks([0.1, 0.9, 0.2, 0.3], 2)).toEqual([0.9, 0.3]);
    expect(bucketPeaks([], 3)).toEqual([0, 0, 0]);
    expect(bucketPeaks([0.5], 3)).toEqual([0.5, 0.5, 0.5]);
  });

  it('bandsOf spreads the voice bins over the meter', () => {
    const bins = new Uint8Array(128).fill(255);
    const bands = bandsOf(bins);
    expect(bands).toHaveLength(METER_BANDS);
    expect(bands.every((b) => b === 1)).toBe(true);
  });

  it('failureOf tells a refusal from a missing device', () => {
    expect(failureOf(new DOMException('no', 'NotAllowedError'))).toBe('denied');
    expect(failureOf(new DOMException('no', 'NotFoundError'))).toBe('noDevice');
    expect(failureOf('weird')).toBe('noDevice');
  });
});
