// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Capture } from '@/features/student/exercises/recorder';

import type { SoundSessionApi } from './session-api';
import type { SessionItems, SoundSession, TakeResult } from './types';
import { useSoundSession } from './use-sound-session';

vi.mock('next-intl', () => ({ useLocale: () => 'ru' }));

const STEP = {
  phase: 'drill',
  atomId: 'nb:kj',
  family: 'kj',
  elementIndex: 0,
  element: { kind: 'word', word: 'kino' },
  say: 'kino',
  sentence: 'Nå sier jeg kino igjen.',
  fails: 0,
} as const;

const session = (over: Partial<SoundSession> = {}): SoundSession => ({
  attemptId: 'a1',
  resumed: false,
  language: 'nb',
  basis: 'chosen',
  phase: 'drill',
  doneReason: null,
  takes: 0,
  maxTakes: 10,
  takeIndex: 0,
  sounds: [],
  diagnostic: null,
  step: STEP,
  ...over,
});

const items = (s: SoundSession): SessionItems => ({ session: s, clips: [], instruction: null });
const take = (over: Partial<TakeResult>): TakeResult => ({
  outcome: 'judged',
  reason: null,
  verdict: { measured: true, passed: true, key: null },
  feedback: null,
  toneme: null,
  events: [],
  session: session({ takeIndex: 1, takes: 1 }),
  ...over,
});

const refusal = (status: number, code: string | null = null, takeIndex: number | null = null) => ({
  ok: false as const,
  refusal: { status, code, retryAfterMs: null, takeIndex },
});

const capture: Capture = { blob: new Blob(['x']), mimeType: 'audio/webm', seconds: 1, envelope: [] };

let api: { [K in keyof SoundSessionApi]: ReturnType<typeof vi.fn> };
const upload = vi.fn(async () => ({ assetId: 'r1' }));

function setup() {
  return renderHook(() => useSoundSession({ language: 'nb', api: api as unknown as SoundSessionApi, upload }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
  upload.mockClear();
  api = { start: vi.fn(), items: vi.fn(), take: vi.fn(), submit: vi.fn() };
  api.start.mockResolvedValue({ ok: true, data: { session: session(), budget: null } });
  api.items.mockResolvedValue({ ok: true, data: items(session()) });
});

describe('useSoundSession', () => {
  it('start lands on the first step', async () => {
    const { result } = setup();
    await act(() => result.current.start('nb:kj'));
    expect(api.start).toHaveBeenCalledWith('nb', 'nb:kj');
    expect(api.items).toHaveBeenCalledWith('a1', 'ru');
    expect(result.current.phase).toBe('step');
  });

  it('a refused door is shown with the engine’s code', async () => {
    api.start.mockResolvedValue(refusal(422, 'SESSION_LIMIT'));
    const { result } = setup();
    await act(() => result.current.start());
    expect(result.current.phase).toBe('refused');
    expect(result.current.refusal?.code).toBe('SESSION_LIMIT');
  });

  it('a take sends the session’s take index and shows the verdict, then next loads the step', async () => {
    const { result } = setup();
    await act(() => result.current.start());
    api.take.mockResolvedValue({ ok: true, data: take({}) });
    await act(() => result.current.sendTake(capture));
    expect(api.take).toHaveBeenCalledWith('a1', { recordingAssetId: 'r1', takeIndex: 0, explanationLanguage: 'ru' });
    expect(result.current.phase).toBe('verdict');
    api.items.mockResolvedValue({ ok: true, data: items(session({ takeIndex: 1 })) });
    await act(() => result.current.next());
    expect(result.current.phase).toBe('step');
    expect(result.current.take).toBeNull();
  });

  it('a retry is not a take: the same step stays, with a notice', async () => {
    const { result } = setup();
    await act(() => result.current.start());
    api.take.mockResolvedValue({ ok: true, data: take({ outcome: 'retry', reason: 'recording_inaudible', verdict: null }) });
    await act(() => result.current.sendTake(capture));
    expect(result.current.phase).toBe('step');
    expect(result.current.notice).toBe('inaudible');
  });

  it('a stale take reloads the step instead of failing', async () => {
    const { result } = setup();
    await act(() => result.current.start());
    api.take.mockResolvedValue(refusal(409, 'STALE_TAKE', 3));
    api.items.mockResolvedValue({ ok: true, data: items(session({ takeIndex: 3 })) });
    await act(() => result.current.sendTake(capture));
    expect(result.current.phase).toBe('step');
    expect(result.current.notice).toBe('stale');
    expect(result.current.session?.takeIndex).toBe(3);
  });

  it('a failed upload costs no take', async () => {
    upload.mockRejectedValueOnce(new Error('net'));
    const { result } = setup();
    await act(() => result.current.start());
    await act(() => result.current.sendTake(capture));
    expect(api.take).not.toHaveBeenCalled();
    expect(result.current.notice).toBe('uploadFailed');
    expect(result.current.phase).toBe('step');
  });

  it('a stopped session goes from the verdict to the hand-in', async () => {
    const { result } = setup();
    await act(() => result.current.start());
    api.take.mockResolvedValue({ ok: true, data: take({ outcome: 'stopped', reason: 'pool_empty' }) });
    await act(() => result.current.sendTake(capture));
    await act(() => result.current.next());
    expect(result.current.phase).toBe('ending');
    api.submit.mockResolvedValue({
      ok: true,
      data: { score: 100, doneReason: 'pool_empty', sounds: [], diagnosticWeak: [], flagged: [] },
    });
    await act(() => result.current.finish());
    expect(api.submit).toHaveBeenCalledWith('a1', 'ru');
    expect(result.current.phase).toBe('result');
  });

  it('a session that is already done opens at the hand-in', async () => {
    api.start.mockResolvedValue({
      ok: true,
      data: { session: session({ phase: 'done', doneReason: 'finished', step: null }), budget: null },
    });
    const { result } = setup();
    await act(() => result.current.start());
    expect(result.current.phase).toBe('ending');
    expect(api.items).not.toHaveBeenCalled();
  });
});
