import { describe, expect, it } from 'vitest';

import { buildHref, wsHref, WORKSPACE_ROUTES } from './href';

describe('wsHref', () => {
  it('addresses a screen inside a workspace', () => {
    expect(wsHref('nordick', 'groups')).toBe('/school/nordick/groups');
  });

  it('sends a section that has moved to its workspace address', () => {
    expect(WORKSPACE_ROUTES.has('content')).toBe(true);
    expect(wsHref('ws-1', 'content')).toBe('/w/ws-1/content');
    expect(wsHref('ws-1', 'content/c-1/lessons/l-2')).toBe('/w/ws-1/content/c-1/lessons/l-2');
  });

  it('does not mistake a section for another whose name it starts with', () => {
    // `contents` is not `content`; only the whole first segment counts.
    expect(wsHref('nordick', 'contents')).toBe('/school/nordick/contents');
  });

  it('gives the workspace root when asked for no screen', () => {
    expect(wsHref('nordick')).toBe('/school/nordick');
  });

  it('keeps query strings and nested segments intact', () => {
    expect(wsHref('nordick', 'review?course=abc&type=writing_task')).toBe(
      '/school/nordick/review?course=abc&type=writing_task',
    );
    expect(wsHref('nordick', 'students/s-1?tab=mastery')).toBe(
      '/school/nordick/students/s-1?tab=mastery',
    );
  });

  it('does not double the separator when the caller writes a leading slash', () => {
    expect(wsHref('nordick', '/groups')).toBe('/school/nordick/groups');
  });

  it('prefers the slug over the id while the old routes are the real ones', () => {
    expect(wsHref({ id: 'ws-1', slug: 'nordick' })).toBe('/school/nordick');
    // A solo workspace has no slug to prefer, and it is addressed by id even today.
    expect(wsHref({ id: 'ws-1', slug: null })).toBe('/school/ws-1');
  });

  it('leaves every section that has not moved where it is', () => {
    for (const section of ['groups', 'students', 'review', 'settings', 'dashboard']) {
      expect(WORKSPACE_ROUTES.has(section)).toBe(false);
      expect(wsHref('nordick', section)).toBe(`/school/nordick/${section}`);
    }
  });

  it('addresses a screen by workspace id once the routes are switched on', () => {
    expect(buildHref(true, { id: 'ws-1', slug: 'nordick' }, 'groups')).toBe('/w/ws-1/groups');
    expect(buildHref(true, 'ws-1', 'content/c-1')).toBe('/w/ws-1/content/c-1');
    // The slug stops being the address the moment the workspace itself is one.
    expect(buildHref(true, { id: 'ws-1', slug: 'nordick' })).toBe('/w/ws-1');
  });
});
