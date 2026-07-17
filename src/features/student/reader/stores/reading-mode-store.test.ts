import { afterEach, describe, expect, it } from 'vitest';

import { useReadingModeStore } from './reading-mode-store';

afterEach(() => {
  useReadingModeStore.setState({ mode: 'immersive' });
  window.localStorage.clear();
});

describe('useReadingModeStore', () => {
  it('defaults to immersive', () => {
    expect(useReadingModeStore.getState().mode).toBe('immersive');
  });

  it('updates the mode', () => {
    useReadingModeStore.getState().setMode('bilingual');
    expect(useReadingModeStore.getState().mode).toBe('bilingual');
  });

  it('persists the mode across store instances (same localStorage key)', () => {
    useReadingModeStore.getState().setMode('focus');
    const persisted = window.localStorage.getItem('ssz:reader:reading-mode:v1');
    expect(persisted).toContain('focus');
  });
});
