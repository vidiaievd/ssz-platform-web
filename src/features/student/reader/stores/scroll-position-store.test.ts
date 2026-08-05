import { afterEach, describe, expect, it } from 'vitest';

import { useScrollPositionStore } from './scroll-position-store';

afterEach(() => {
  useScrollPositionStore.setState({ positions: {} });
  window.localStorage.clear();
});

describe('useScrollPositionStore', () => {
  it('defaults to no scroll offset for an unseen key', () => {
    expect(useScrollPositionStore.getState().getPosition('lesson-1:variant-1')).toBe(0);
  });

  it('records a position per key without clobbering others', () => {
    useScrollPositionStore.getState().setPosition('lesson-1:variant-1', 320);
    useScrollPositionStore.getState().setPosition('lesson-2:variant-1', 40);

    expect(useScrollPositionStore.getState().getPosition('lesson-1:variant-1')).toBe(320);
    expect(useScrollPositionStore.getState().getPosition('lesson-2:variant-1')).toBe(40);
  });

  it('persists across store instances under the v1 key', () => {
    useScrollPositionStore.getState().setPosition('lesson-1:variant-1', 500);
    const persisted = window.localStorage.getItem('ssz:reader:scroll-position:v1');
    expect(persisted).toContain('500');
  });
});
