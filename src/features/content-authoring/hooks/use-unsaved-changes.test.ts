import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useUnsavedChanges } from './use-unsaved-changes';

describe('useUnsavedChanges', () => {
  it('starts clean', () => {
    const { result } = renderHook(() => useUnsavedChanges({ onSave: vi.fn() }));

    expect(result.current.status).toBe('idle');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.savedAt).toBeNull();
  });

  it('never reaches the server on its own', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUnsavedChanges({ onSave }));

    act(() => result.current.markDirty());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.status).toBe('dirty');
    expect(result.current.isDirty).toBe(true);
  });

  it('saves only when asked, and comes back clean', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUnsavedChanges({ onSave }));

    act(() => result.current.markDirty());
    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.save();
    });

    expect(saved).toBe(true);
    expect(onSave).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('saved');
    expect(result.current.savedAt).toBeInstanceOf(Date);
    expect(result.current.isDirty).toBe(false);
  });

  it('keeps the edits dirty when the save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useUnsavedChanges({ onSave }));

    act(() => result.current.markDirty());
    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.save();
    });

    expect(saved).toBe(false);
    expect(result.current.status).toBe('error');
    expect(result.current.savedAt).toBeNull();
    // Still unsaved — the unload guard must stay armed.
    expect(result.current.isDirty).toBe(true);
  });

  it('calls the latest onSave closure', async () => {
    const firstSave = vi.fn().mockResolvedValue(undefined);
    const secondSave = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(({ onSave }) => useUnsavedChanges({ onSave }), {
      initialProps: { onSave: firstSave },
    });

    rerender({ onSave: secondSave });
    await act(async () => {
      await result.current.save();
    });

    expect(secondSave).toHaveBeenCalledOnce();
    expect(firstSave).not.toHaveBeenCalled();
  });

  it('markSaved() reports a save the caller performed itself', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges({ onSave }));

    act(() => result.current.markDirty());
    act(() => result.current.markSaved());

    expect(result.current.status).toBe('saved');
    expect(result.current.savedAt).toBeInstanceOf(Date);
    expect(result.current.isDirty).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reset() drops the dirty flag without saving', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useUnsavedChanges({ onSave }));

    act(() => result.current.markDirty());
    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.isDirty).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('warns before unload only while there are unsaved edits', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { result } = renderHook(() => useUnsavedChanges({ onSave: vi.fn() }));

    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    act(() => result.current.markDirty());
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    act(() => result.current.markSaved());
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('does not arm the unload guard when the caller opts out', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { result } = renderHook(() =>
      useUnsavedChanges({ onSave: vi.fn(), warnOnUnload: false }),
    );

    act(() => result.current.markDirty());

    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
    addSpy.mockRestore();
  });
});
