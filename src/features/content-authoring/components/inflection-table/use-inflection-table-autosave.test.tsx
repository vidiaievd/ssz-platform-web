import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readAudioDraft } from '@/lib/shared-kernel/audio';
import { sampleContent, setLemma } from '@/lib/shared-kernel/inflection-table';

import type { InflectionTableDocument } from './edits';
import { sameDocument, useInflectionTableAutosave } from './use-inflection-table-autosave';

vi.mock('../../actions/inflection-table', () => ({ saveInflectionTableAction: vi.fn() }));
const { saveInflectionTableAction } = await import('../../actions/inflection-table');
const save = vi.mocked(saveInflectionTableAction);

function doc(lemma = 'en jobb'): InflectionTableDocument {
  const base = sampleContent();
  return {
    ...setLemma(base, 'r1', lemma),
    updatedAt: 't0',
    audio: readAudioDraft({}, 'inflection_table'),
  };
}

function mount(initial: InflectionTableDocument) {
  const onSaved = vi.fn();
  const hook = renderHook(
    ({ exercise }) =>
      useInflectionTableAutosave({ exerciseId: 'e1', containerId: 'c1', exercise, onSaved }),
    { initialProps: { exercise: initial } },
  );
  return { ...hook, onSaved };
}

beforeEach(() => {
  vi.useFakeTimers();
  save.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('useInflectionTableAutosave', () => {
  it('writes nothing for a document nobody edited', async () => {
    mount(doc());
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(save).not.toHaveBeenCalled();
  });

  it('saves a burst of edits once, after 850 ms, with both columns and the token', async () => {
    save.mockResolvedValue({ ok: true, value: { status: 'saved', updatedAt: 't1' } });
    const { rerender, onSaved, result } = mount(doc());

    rerender({ exercise: doc('en jobb 2') });
    await act(() => vi.advanceTimersByTimeAsync(500));
    rerender({ exercise: doc('en jobb 3') });
    await act(() => vi.advanceTimersByTimeAsync(849));
    expect(save).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(2));

    expect(save).toHaveBeenCalledTimes(1);
    const [exerciseId, containerId, input] = save.mock.calls[0]!;
    expect([exerciseId, containerId]).toEqual(['e1', 'c1']);
    expect(input.expectedUpdatedAt).toBe('t0');
    expect(input.instructions).toBe(sampleContent().instruction);
    // The key goes in the answers column, by `rowId:slotId`, and never in the content.
    expect(input.expectedAnswers.cells['r1:defSg']!.value).toBe('jobben');
    expect(JSON.stringify(input.content)).not.toContain('jobben');
    // The layer is off by default, so no audio block is written beside the document.
    expect((input.content as Record<string, unknown>)['audio']).toBeUndefined();
    expect(onSaved).toHaveBeenCalledWith('t1', expect.anything());
    expect(result.current.status).toBe('saved');
  });

  it('stops retrying a refused document, and retries a blip with backoff', async () => {
    save.mockResolvedValueOnce({ ok: false, error: { code: 'network', message: 'down' } } as never);
    const { rerender, result } = mount(doc());
    rerender({ exercise: doc('en jobb 2') });
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
    rerender({ exercise: doc('en jobb 2') });
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
