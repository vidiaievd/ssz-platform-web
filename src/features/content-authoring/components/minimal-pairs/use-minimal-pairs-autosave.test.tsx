import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SAMPLE_PAIR_IDS } from '@/lib/shared-kernel/minimal-pairs';

import { setTitle, type MinimalPairsDocument } from './edits';
import { sampleMinimalPairs } from './test-support';
import { sameDocument, useMinimalPairsAutosave } from './use-minimal-pairs-autosave';

vi.mock('../../actions/minimal-pairs', () => ({ saveMinimalPairsAction: vi.fn() }));
const { saveMinimalPairsAction } = await import('../../actions/minimal-pairs');
const save = vi.mocked(saveMinimalPairsAction);

function doc(title = 'Hører du kj eller sj?'): MinimalPairsDocument {
  return { ...setTitle(sampleMinimalPairs(), title), updatedAt: 't0' };
}

function mount(initial: MinimalPairsDocument) {
  const onSaved = vi.fn();
  const hook = renderHook(
    ({ exercise }) =>
      useMinimalPairsAutosave({ exerciseId: 'e1', containerId: 'c1', exercise, onSaved }),
    { initialProps: { exercise: initial } },
  );
  return { ...hook, onSaved };
}

beforeEach(() => {
  vi.useFakeTimers();
  save.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('useMinimalPairsAutosave (MP-B27)', () => {
  it('writes nothing for a document nobody edited', async () => {
    mount(doc());
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(save).not.toHaveBeenCalled();
  });

  it('saves a burst of edits once, after 850 ms, with both columns, the line and the token', async () => {
    save.mockResolvedValue({ ok: true, value: { status: 'saved', updatedAt: 't1' } });
    const { rerender, onSaved, result } = mount(doc());

    rerender({ exercise: doc('Hører du kj eller sj? 2') });
    await act(() => vi.advanceTimersByTimeAsync(500));
    rerender({ exercise: doc('Hører du kj eller sj? 3') });
    await act(() => vi.advanceTimersByTimeAsync(849));
    expect(save).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(2));

    expect(save).toHaveBeenCalledTimes(1);
    const [exerciseId, containerId, input] = save.mock.calls[0]!;
    expect([exerciseId, containerId]).toEqual(['e1', 'c1']);
    expect(input.expectedUpdatedAt).toBe('t0');
    expect(input.instructions).toBe(sampleMinimalPairs().instruction);
    expect((input.content as { title: string }).title).toBe('Hører du kj eller sj? 3');
    // The teacher's note is the only thing in the answers column, keyed by pair id, never content.
    expect(input.expectedAnswers.pairs[SAMPLE_PAIR_IDS[0]]!.note).toContain('Startparet');
    expect(JSON.stringify(input.content)).not.toContain('Startparet');
    expect(onSaved).toHaveBeenCalledWith('t1', expect.anything());
    expect(result.current.status).toBe('saved');
  });

  it('sends the token the previous save earned, not the one the screen has not caught up to (plan 70 finding 4)', async () => {
    let finish!: (v: unknown) => void;
    save.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)) as never);
    save.mockResolvedValue({ ok: true, value: { status: 'saved', updatedAt: 't2' } });
    const { rerender } = mount(doc());

    rerender({ exercise: doc('Hører du kj eller sj? 2') });
    await act(() => vi.advanceTimersByTimeAsync(851)); // save 1 goes out, carrying t0
    // A second edit lands while it is on the wire; the screen still shows t0.
    rerender({ exercise: doc('Hører du kj eller sj? 3') });
    await act(async () => finish({ ok: true, value: { status: 'saved', updatedAt: 't1' } }));
    await act(() => vi.advanceTimersByTimeAsync(900));

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0]![2].expectedUpdatedAt).toBe('t0');
    expect(save.mock.calls[1]![2].expectedUpdatedAt).toBe('t1');
  });

  it('stops retrying a refused document, and retries a blip with backoff', async () => {
    save.mockResolvedValueOnce({ ok: false, error: { code: 'network', message: 'down' } } as never);
    const { rerender, result } = mount(doc());
    rerender({ exercise: doc('Hører du kj eller sj? 2') });
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
    rerender({ exercise: doc('Hører du kj eller sj? 2') });
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
