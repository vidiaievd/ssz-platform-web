import { afterEach, describe, expect, it } from 'vitest';

import { useReadingModeStore } from './reading-mode-store';

afterEach(() => {
  useReadingModeStore.setState({ mode: null });
  window.localStorage.clear();
});

describe('useReadingModeStore', () => {
  it('defaults to no preference, letting the level decide', () => {
    expect(useReadingModeStore.getState().mode).toBeNull();
  });

  it('updates the mode', () => {
    useReadingModeStore.getState().setMode('bilingual');
    expect(useReadingModeStore.getState().mode).toBe('bilingual');
  });

  it('persists the mode across store instances under the v2 key', () => {
    useReadingModeStore.getState().setMode('focus');
    const persisted = window.localStorage.getItem('ssz:reader:reading-mode:v2');
    expect(persisted).toContain('focus');
  });
});
