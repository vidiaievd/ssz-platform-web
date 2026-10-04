import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emptyContent, newSegment } from '@/lib/shared-kernel/dictation';

import type { DictationDocument } from './edits';
import { sameDocument, useDictationAutosave } from './use-dictation-autosave';

vi.mock('../../actions/dictation', () => ({ saveDictationAction: vi.fn() }));
const { saveDictationAction } = await import('../../actions/dictation');
const save = vi.mocked(saveDictationAction);

function doc(text = ''): DictationDocument {
  return {
    ...emptyContent('nb', 'Skriv.'),
    segments: [{ ...newSegment(), id: 's1', text }],
    updatedAt: 't0',
  };
}

function mount(initial: DictationDocument) {
  const onSaved = vi.fn();
  const hook = renderHook(
    ({ exercise }) =>
      useDictationAutosave({ exerciseId: 'e1', containerId: 'c1', exercise, onSaved }),
    { initialProps: { exercise: initial } },
  );
  return { ...hook, onSaved };
}

beforeEach(() => {
  vi.useFakeTimers();
  save.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('useDictationAutosave', () => {
  it('writes nothing for a document nobody edited', async () => {
    mount(doc());
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(save).not.toHaveBeenCalled();
  });

  it('saves a burst of edits once, after 850 ms, with both columns and the token', async () => {
    save.mockResolvedValue({ ok: true, value: { status: 'saved', updatedAt: 't1' } });
    const { rerender, onSaved, result } = mount(doc());

    rerender({ exercise: doc('Jeg') });
    await act(() => vi.advanceTimersByTimeAsync(500));
    rerender({ exercise: doc('Jeg hørte') });
    await act(() => vi.advanceTimersByTimeAsync(849));
    expect(save).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(2));

    expect(save).toHaveBeenCalledTimes(1);
    const [exerciseId, containerId, input] = save.mock.calls[0]!;
    expect([exerciseId, containerId]).toEqual(['e1', 'c1']);
    expect(input.expectedUpdatedAt).toBe('t0');
    expect(input.instructions).toBe('Skriv.');
    // The key goes in the answers column and never in the content.
    expect(input.expectedAnswers.segments['s1']!.text).toBe('Jeg hørte');
    expect(JSON.stringify(input.content)).not.toContain('hørte');
    // The audio block travels in the content, switched on.
    expect(input.content.audio.enabled).toBe(true);
    expect(onSaved).toHaveBeenCalledWith('t1', expect.anything());
    expect(result.current.status).toBe('saved');
  });

  it('stops retrying a refused document, and retries a blip with backoff', async () => {
    save.mockResolvedValueOnce({
      ok: false,
      error: { code: 'network', message: 'down' },
    } as never);
    const { rerender, result } = mount(doc());
    rerender({ exercise: doc('Jeg') });
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
    save.mockResolvedValueOnce({
      ok: true,
      value: { status: 'conflict', currentUpdatedAt: 't9' },
    });
    const { rerender, result } = mount(doc());
    rerender({ exercise: doc('Jeg') });
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
    const a = doc('x');
    expect(sameDocument(a, { ...a, updatedAt: 't5' })).toBe(true);
    expect(sameDocument(a, { ...a, title: 'T' })).toBe(false);
  });
});
