import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyAudioDraft } from '@/lib/shared-kernel/audio';

import { setTitle, type ReadAloudDocument } from './edits';
import { sampleReadAloud } from './test-support';
import { sameDocument, useReadAloudAutosave } from './use-read-aloud-autosave';

vi.mock('../../actions/read-aloud', () => ({ saveReadAloudAction: vi.fn() }));
const { saveReadAloudAction } = await import('../../actions/read-aloud');
const save = vi.mocked(saveReadAloudAction);

function doc(title = 'Les høyt'): ReadAloudDocument {
  return { ...setTitle(sampleReadAloud(), title), updatedAt: 't0' };
}

function mount(initial: ReadAloudDocument) {
  const onSaved = vi.fn();
  const hook = renderHook(
    ({ exercise }) =>
      useReadAloudAutosave({ exerciseId: 'e1', containerId: 'c1', exercise, onSaved }),
    { initialProps: { exercise: initial } },
  );
  return { ...hook, onSaved };
}

beforeEach(() => {
  vi.useFakeTimers();
  save.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('useReadAloudAutosave (RA-B16)', () => {
  it('writes nothing for a document nobody edited', async () => {
    mount(doc());
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(save).not.toHaveBeenCalled();
  });

  it('saves a burst of edits once, after 850 ms, with both columns, the line and the token', async () => {
    save.mockResolvedValue({ ok: true, value: { status: 'saved', updatedAt: 't1' } });
    const { rerender, onSaved, result } = mount(doc());

    rerender({ exercise: doc('Les høyt 2') });
    await act(() => vi.advanceTimersByTimeAsync(500));
    rerender({ exercise: doc('Les høyt 3') });
    await act(() => vi.advanceTimersByTimeAsync(849));
    expect(save).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(2));

    expect(save).toHaveBeenCalledTimes(1);
    const [exerciseId, containerId, input] = save.mock.calls[0]!;
    expect([exerciseId, containerId]).toEqual(['e1', 'c1']);
    expect(input.expectedUpdatedAt).toBe('t0');
    expect(input.instructions).toBe(sampleReadAloud().instruction);
    expect((input.content as { title: string }).title).toBe('Les høyt 3');
    // The listening note and the descriptors are the key: answers column only, never content.
    expect(input.expectedAnswers.prompts['p1aaaa']!.note).toContain('Lytt etter kj/sj');
    expect(input.expectedAnswers.rubric['pron']!.levels[3]).toContain('Tydelig');
    expect(JSON.stringify(input.content)).not.toContain('Lytt etter');
    expect(JSON.stringify(input.content)).not.toContain('Tydelig og trygg');
    // The layer is off by default, so no audio block is written beside the document.
    expect((input.content as Record<string, unknown>)['audio']).toBeUndefined();
    expect(onSaved).toHaveBeenCalledWith('t1', expect.anything());
    expect(result.current.status).toBe('saved');
  });

  it('writes the audio block beside the document when the layer is on, and not inside the kernel’s content (RA-B16)', async () => {
    save.mockResolvedValue({ ok: true, value: { status: 'saved', updatedAt: 't1' } });
    const base = doc();
    const { rerender } = mount(base);
    const on = {
      ...base,
      audio: {
        ...base.audio,
        audio: { ...base.audio.audio, enabled: true, source: 'link' as const },
      },
    };
    rerender({ exercise: on });
    await act(() => vi.advanceTimersByTimeAsync(900));
    const content = save.mock.calls[0]![2].content as Record<string, unknown>;
    expect((content['audio'] as { enabled: boolean }).enabled).toBe(true);
    expect(content).toEqual(
      expect.objectContaining(
        applyAudioDraft({ ...(content as object) }, on.audio, 'read_aloud') as object,
      ),
    );
  });

  it('stops retrying a refused document, and retries a blip with backoff', async () => {
    save.mockResolvedValueOnce({ ok: false, error: { code: 'network', message: 'down' } } as never);
    const { rerender, result } = mount(doc());
    rerender({ exercise: doc('Les høyt 2') });
    await act(() => vi.advanceTimersByTimeAsync(900));
    expect(result.current.status).toBe('failed');
    expect(result.current.failures).toBe(1);

    save.mockResolvedValueOnce({
      ok: false,
      error: { code: 'validation', message: 'Refused.' },
    } as never);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(result.current.status).toBe('rejected');
    expect(result.current.rejection).toBe('Refused.');
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('hands a conflict to the author and overwrites only on request', async () => {
    save.mockResolvedValueOnce({ ok: true, value: { status: 'conflict', currentUpdatedAt: 't9' } });
    const { rerender, result } = mount(doc());
    rerender({ exercise: doc('Les høyt 2') });
    await act(() => vi.advanceTimersByTimeAsync(900));
    expect(result.current.status).toBe('conflict');
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(save).toHaveBeenCalledTimes(1);

    save.mockResolvedValueOnce({ ok: true, value: { status: 'saved', updatedAt: 't10' } });
    await act(async () => result.current.overwrite());
    expect(save.mock.calls[1]![2].expectedUpdatedAt).toBe('t9');
    expect(result.current.status).toBe('saved');
  });
});

describe('sameDocument', () => {
  it('ignores the token, nothing else', () => {
    const a = doc();
    expect(sameDocument(a, { ...a, updatedAt: 't5' })).toBe(true);
    expect(sameDocument(a, { ...a, title: 'T' })).toBe(false);
  });
});
