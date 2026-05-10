import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './ui-store';

describe('useUiStore', () => {
  beforeEach(() => useUiStore.setState({ sidebarCollapsed: false }));

  it('toggles the sidebar', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });
});
