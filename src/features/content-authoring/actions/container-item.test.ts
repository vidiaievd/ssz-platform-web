// @vitest-environment node

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'ssz_at' ? { value: 'test-token' } : undefined),
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () => new Headers(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { duplicateContainerItemAction, discardDuplicateAction, moveItemToContainerAction } =
  await import('./container-item');

const BASE = 'http://content.test/api/v1';
const draft = (id: string) => ({
  items: [{ id, status: 'draft', versionNumber: 1, containerId: 'x', createdAt: '2026-10-19' }],
});

/** Every DELETE the content-service receives, as `METHOD path`. */
let deletes: string[];

beforeEach(() => {
  deletes = [];
  server.use(
    http.get(`${BASE}/containers/course-1/versions`, () => HttpResponse.json(draft('course-v'))),
    http.get(`${BASE}/containers/module-copy/versions`, () => HttpResponse.json(draft('copy-v'))),
    http.get(`${BASE}/containers/module-copy/versions/copy-v/items`, () =>
      HttpResponse.json([
        { id: 'r1', itemType: 'lesson', itemId: 'lesson-copy' },
        { id: 'r2', itemType: 'vocabulary_list', itemId: 'list-original' },
        { id: 'r3', itemType: 'grammar_rule', itemId: 'rule-original' },
        { id: 'r4', itemType: 'exercise', itemId: 'exercise-copy' },
      ]),
    ),
    http.delete(`${BASE}/*`, ({ request }) => {
      deletes.push(new URL(request.url).pathname.replace('/api/v1', ''));
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

describe('duplicateContainerItemAction', () => {
  it('copies the row in the draft and returns the new row with its copy', async () => {
    server.use(
      http.post(`${BASE}/containers/course-1/versions/course-v/items/row-1/duplicate`, () =>
        HttpResponse.json(
          { itemId: 'row-copy', position: 4, materialId: 'module-copy' },
          { status: 201 },
        ),
      ),
    );

    const result = await duplicateContainerItemAction('course-1', 'row-1');

    expect(result).toEqual({ ok: true, value: { id: 'row-copy', materialId: 'module-copy' } });
  });
});

describe('discardDuplicateAction', () => {
  it('takes the row away and deletes an exercise copy', async () => {
    const result = await discardDuplicateAction({
      containerId: 'course-1',
      rowId: 'row-copy',
      itemType: 'exercise',
      materialId: 'exercise-copy',
    });

    expect(result.ok).toBe(true);
    expect(deletes).toEqual([
      '/containers/course-1/versions/course-v/items/row-copy',
      '/exercises/exercise-copy',
    ]);
  });

  // The module copy's lists and rules are the original's, placed again: deleting
  // them would destroy the original module's material.
  it("deletes a module copy with its own copies, never the original's lists and rules", async () => {
    const result = await discardDuplicateAction({
      containerId: 'course-1',
      rowId: 'row-copy',
      itemType: 'container',
      materialId: 'module-copy',
    });

    expect(result.ok).toBe(true);
    expect(deletes).toEqual([
      '/containers/course-1/versions/course-v/items/row-copy',
      '/lessons/lesson-copy',
      '/exercises/exercise-copy',
      '/containers/module-copy',
    ]);
  });
});

describe('moveItemToContainerAction', () => {
  it("moves the row and orders the target with the row's new id in its place", async () => {
    let moveBody: unknown;
    let order: unknown;
    server.use(
      http.get(`${BASE}/containers/module-17b/versions`, () => HttpResponse.json(draft('v-17b'))),
      http.get(`${BASE}/containers/module-17c/versions`, () => HttpResponse.json(draft('v-17c'))),
      http.post(
        `${BASE}/containers/module-17b/versions/v-17b/items/row-1/move`,
        async ({ request }) => {
          moveBody = await request.json();
          return HttpResponse.json({ itemId: 'row-new', position: 7 }, { status: 201 });
        },
      ),
      http.put(
        `${BASE}/containers/module-17c/versions/v-17c/items/reorder`,
        async ({ request }) => {
          order = await request.json();
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    const result = await moveItemToContainerAction({
      containerId: 'module-17b',
      itemId: 'row-1',
      targetContainerId: 'module-17c',
      targetSectionId: 'section-ord',
      targetOrder: ['a', 'row-1', 'b'],
    });

    expect(result).toEqual({ ok: true, value: { id: 'row-new' } });
    expect(moveBody).toEqual({ targetContainerId: 'module-17c', targetSectionId: 'section-ord' });
    expect(order).toEqual({ orderedItemIds: ['a', 'row-new', 'b'] });
  });
});
