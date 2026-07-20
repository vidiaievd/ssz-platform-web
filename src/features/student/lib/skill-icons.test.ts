import { describe, expect, it } from 'vitest';

import { HANDOFF_ICON_MAP, getHandoffIcon } from './skill-icons';

describe('HANDOFF_ICON_MAP', () => {
  it('resolves every mapped handoff icon name to a component', () => {
    for (const name of Object.keys(HANDOFF_ICON_MAP)) {
      expect(HANDOFF_ICON_MAP[name]).toBeDefined();
    }
  });

  it('getHandoffIcon returns the same component as the map', () => {
    expect(getHandoffIcon('bookOpen')).toBe(HANDOFF_ICON_MAP.bookOpen);
  });
});
