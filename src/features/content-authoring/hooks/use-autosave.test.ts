import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutosave } from './use-autosave';

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts with idle status and no savedAt', () => {
    const { result } = renderHook(() => useAutosave({ onSave: vi.fn(), debounceMs: 1500 }));

    expect(result.current.status).toBe('idle');
    expect(result.current.savedAt).toBeNull();
  });

  it('remains idle until the debounce fires', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ onSave, debounceMs: 1500 }));

    act(() => result.current.schedule());
    act(() => vi.advanceTimersByTime(1000));

    expect(result.current.status).toBe('idle');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('transitions idle → saving → saved after the debounce', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ onSave, debounceMs: 1500 }));

    act(() => result.current.schedule());

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.status).toBe('saved');
    expect(result.current.savedAt).toBeInstanceOf(Date);
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('transitions to error when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useAutosave({ onSave, debounceMs: 1500 }));

    act(() => result.current.schedule());

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.savedAt).toBeNull();
  });

  it('cancel() prevents a pending save from firing', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ onSave, debounceMs: 1500 }));

    act(() => result.current.schedule());
    act(() => result.current.cancel());

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('schedule() resets the debounce timer on rapid calls', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ onSave, debounceMs: 1500 }));

    act(() => result.current.schedule());
    act(() => vi.advanceTimersByTime(800));
    act(() => result.current.schedule()); // reset timer

    // 800ms after first + 800ms more = 1600ms since first, but only 800ms since second
    act(() => vi.advanceTimersByTime(800));
    expect(onSave).not.toHaveBeenCalled();

    // advance the remaining 700ms to complete the second debounce window
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(onSave).toHaveBeenCalledOnce();
  });

  it('markSaved() sets saved status and timestamp without calling onSave', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useAutosave({ onSave, debounceMs: 1500 }));

    act(() => result.current.markSaved());

    expect(result.current.status).toBe('saved');
    expect(result.current.savedAt).toBeInstanceOf(Date);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('always calls the latest onSave closure without restarting the timer', async () => {
    let callCount = 0;
    const firstSave = vi.fn().mockImplementation(async () => {
      callCount++;
    });
    const secondSave = vi.fn().mockImplementation(async () => {
      callCount += 10;
    });

    const { result, rerender } = renderHook(
      ({ onSave }) => useAutosave({ onSave, debounceMs: 1500 }),
      { initialProps: { onSave: firstSave } },
    );

    act(() => result.current.schedule());

    // Swap the callback before the timer fires
    rerender({ onSave: secondSave });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    // The latest callback (secondSave) should have run
    expect(callCount).toBe(10);
    expect(firstSave).not.toHaveBeenCalled();
  });
});
