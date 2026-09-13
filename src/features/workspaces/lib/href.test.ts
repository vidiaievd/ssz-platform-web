import { describe, expect, it } from 'vitest';

import { wsHref } from './href';

describe('wsHref', () => {
  it('addresses a screen inside a workspace', () => {
    expect(wsHref('ws-1', 'groups')).toBe('/w/ws-1/groups');
    expect(wsHref('ws-1', 'content/c-1/lessons/l-2')).toBe('/w/ws-1/content/c-1/lessons/l-2');
  });

  it('gives the workspace front page when asked for no screen', () => {
    expect(wsHref('ws-1')).toBe('/w/ws-1');
  });

  it('keeps query strings intact', () => {
    expect(wsHref('ws-1', 'review?course=abc&type=writing_task')).toBe(
      '/w/ws-1/review?course=abc&type=writing_task',
    );
  });

  it('does not double the separator when the caller writes a leading slash', () => {
    expect(wsHref('ws-1', '/groups')).toBe('/w/ws-1/groups');
  });

  it('takes the id, never the slug — the workspace is the address', () => {
    expect(wsHref({ id: 'ws-1', slug: 'nordick' }, 'groups')).toBe('/w/ws-1/groups');
    // A solo workspace has no slug at all; it was never addressable by one.
    expect(wsHref({ id: 'ws-1', slug: null }, 'groups')).toBe('/w/ws-1/groups');
  });
});
