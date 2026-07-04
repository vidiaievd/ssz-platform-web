import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { deriveVisualState } from './types';
import { useRunnerState } from './use-runner-state';

/* ─── deriveVisualState pure-function table ─────────────────────────── */

describe('deriveVisualState', () => {
  it('returns loading when isLoading is true (takes priority)', () => {
    expect(deriveVisualState('answering', 'practice', null, true, false)).toBe('loading');
    expect(deriveVisualState('feedback', 'practice', true, true, false)).toBe('loading');
  });

  it('returns error when isError is true (after loading check)', () => {
    expect(deriveVisualState('answering', 'practice', null, false, true)).toBe('error');
    expect(deriveVisualState('feedback', 'graded', null, false, true)).toBe('error');
  });

  it('returns unanswered in answering phase (any mode)', () => {
    expect(deriveVisualState('answering', 'practice', null, false, false)).toBe('unanswered');
    expect(deriveVisualState('answering', 'graded', null, false, false)).toBe('unanswered');
  });

  it('returns submitted for graded mode in feedback phase (never reveals correctness)', () => {
    expect(deriveVisualState('feedback', 'graded', true, false, false)).toBe('submitted');
    expect(deriveVisualState('feedback', 'graded', false, false, false)).toBe('submitted');
    expect(deriveVisualState('feedback', 'graded', null, false, false)).toBe('submitted');
  });

  it('returns correct for practice + feedback + ok=true', () => {
    expect(deriveVisualState('feedback', 'practice', true, false, false)).toBe('correct');
  });

  it('returns incorrect for practice + feedback + ok=false', () => {
    expect(deriveVisualState('feedback', 'practice', false, false, false)).toBe('incorrect');
  });

  it('returns incorrect for practice + feedback + ok=null (no answer graded)', () => {
    expect(deriveVisualState('feedback', 'practice', null, false, false)).toBe('incorrect');
  });
});

/* ─── useRunnerState hook ───────────────────────────────────────────── */

describe('useRunnerState', () => {
  it('starts in answering phase with idx=0', () => {
    const { result } = renderHook(() => useRunnerState({ itemCount: 4 }));
    expect(result.current.idx).toBe(0);
    expect(result.current.phase).toBe('answering');
    expect(result.current.ok).toBeNull();
    expect(result.current.canSubmit).toBe(false);
    expect(result.current.isLast).toBe(false);
  });

  it('submit(true) transitions to feedback with ok=true', () => {
    const { result } = renderHook(() => useRunnerState({ itemCount: 4 }));
    act(() => result.current.submit(true));
    expect(result.current.phase).toBe('feedback');
    expect(result.current.ok).toBe(true);
  });

  it('submit(false) transitions to feedback with ok=false', () => {
    const { result } = renderHook(() => useRunnerState({ itemCount: 4 }));
    act(() => result.current.submit(false));
    expect(result.current.phase).toBe('feedback');
    expect(result.current.ok).toBe(false);
  });

  it('advance() increments idx and resets phase/ok/canSubmit', () => {
    const { result } = renderHook(() => useRunnerState({ itemCount: 4 }));
    act(() => result.current.submit(true));
    act(() => result.current.advance());
    expect(result.current.idx).toBe(1);
    expect(result.current.phase).toBe('answering');
    expect(result.current.ok).toBeNull();
    expect(result.current.canSubmit).toBe(false);
  });

  it('isLast is true on the final item', () => {
    const { result } = renderHook(() => useRunnerState({ itemCount: 2 }));
    act(() => result.current.submit(true));
    act(() => result.current.advance());
    expect(result.current.idx).toBe(1);
    expect(result.current.isLast).toBe(true);
  });

  it('advance() on the last item calls onComplete instead of incrementing', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRunnerState({ itemCount: 1, onComplete }));
    expect(result.current.isLast).toBe(true);
    act(() => result.current.submit(true));
    act(() => result.current.advance());
    expect(onComplete).toHaveBeenCalledOnce();
    expect(result.current.idx).toBe(0);
  });

  it('setCanSubmit updates canSubmit', () => {
    const { result } = renderHook(() => useRunnerState({ itemCount: 4 }));
    act(() => result.current.setCanSubmit(true));
    expect(result.current.canSubmit).toBe(true);
    act(() => result.current.setCanSubmit(false));
    expect(result.current.canSubmit).toBe(false);
  });

  it('reset() returns to initial state', () => {
    const { result } = renderHook(() => useRunnerState({ itemCount: 4 }));
    act(() => result.current.submit(true));
    act(() => result.current.advance());
    act(() => result.current.reset());
    expect(result.current.idx).toBe(0);
    expect(result.current.phase).toBe('answering');
    expect(result.current.ok).toBeNull();
  });
});
