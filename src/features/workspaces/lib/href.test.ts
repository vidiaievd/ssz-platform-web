import { describe, expect, it } from 'vitest';

import { buildHref, wsHref, WORKSPACE_ROUTES } from './href';

describe('wsHref', () => {
  it('addresses a screen inside a workspace', () => {
    expect(wsHref('ws-1', 'groups')).toBe('/w/ws-1/groups');
    expect(wsHref('ws-1', 'content/c-1/lessons/l-2')).toBe('/w/ws-1/content/c-1/lessons/l-2');
  });

  it('leaves a section nobody has moved where it is', () => {
    // Every staff section has moved; a path that names none of them is not one of ours,
    // and inventing `/w/…` for it would point at a route that does not exist.
    expect(WORKSPACE_ROUTES.has('catalogue')).toBe(false);
    expect(wsHref('nordick', 'catalogue')).toBe('/school/nordick/catalogue');
  });

  it('does not mistake a section for another whose name it starts with', () => {
    // `contents` is not `content`; only the whole first segment counts.
    expect(wsHref('nordick', 'contents')).toBe('/school/nordick/contents');
  });

  it('gives the workspace root when asked for no screen', () => {
    expect(wsHref('ws-1')).toBe('/w/ws-1');
  });

  it('keeps query strings and nested segments intact', () => {
    expect(wsHref('ws-1', 'review?course=abc&type=writing_task')).toBe(
      '/w/ws-1/review?course=abc&type=writing_task',
    );
    expect(wsHref('ws-1', 'students/s-1?tab=mastery')).toBe('/w/ws-1/students/s-1?tab=mastery');
  });

  it('does not double the separator when the caller writes a leading slash', () => {
    expect(wsHref('ws-1', '/groups')).toBe('/w/ws-1/groups');
  });

  it('addresses every staff section by workspace', () => {
    for (const section of ['content', 'groups', 'students', 'review', 'settings', 'dashboard']) {
      expect(WORKSPACE_ROUTES.has(section)).toBe(true);
      expect(wsHref('ws-1', section)).toBe(`/w/ws-1/${section}`);
    }
  });

  it('takes the id over the slug now that the workspace is the address', () => {
    expect(wsHref({ id: 'ws-1', slug: 'nordick' }, 'groups')).toBe('/w/ws-1/groups');
    // A solo workspace has no slug at all — it was never addressable by one.
    expect(wsHref({ id: 'ws-1', slug: null }, 'groups')).toBe('/w/ws-1/groups');
  });

  it('addresses a screen by workspace id once the routes are switched on', () => {
    expect(buildHref(true, { id: 'ws-1', slug: 'nordick' }, 'groups')).toBe('/w/ws-1/groups');
    expect(buildHref(true, 'ws-1', 'content/c-1')).toBe('/w/ws-1/content/c-1');
    // The slug stops being the address the moment the workspace itself is one.
    expect(buildHref(true, { id: 'ws-1', slug: 'nordick' })).toBe('/w/ws-1');
  });
});
