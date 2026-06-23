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

const { createSectionAction, reorderSectionsAction, syncStructureSectionsAction } = await import(
  './section'
);

const CONTAINER_ID = 'ctr-1';
const VERSION_ID = 'ver-1';

function mockDraftVersion() {
  server.use(
    http.get(`http://content.test/api/v1/containers/${CONTAINER_ID}/versions`, () =>
      HttpResponse.json({ items: [{ id: VERSION_ID, status: 'draft' }] }),
    ),
  );
}

describe('createSectionAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a section on the draft version', async () => {
    mockDraftVersion();
    server.use(
      http.post(
        `http://content.test/api/v1/containers/${CONTAINER_ID}/versions/${VERSION_ID}/sections`,
        async ({ request }) => {
          const body = (await request.json()) as { title: string };
          expect(body.title).toBe('A1 — Beginner');
          return HttpResponse.json({ sectionId: 'sec-1', position: 0 }, { status: 201 });
        },
      ),
    );

    const result = await createSectionAction(CONTAINER_ID, 'A1 — Beginner');

    expect(result.ok).toBe(true);
  });
});

describe('reorderSectionsAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('puts orderedSectionIds in the request body', async () => {
    mockDraftVersion();
    server.use(
      http.put(
        `http://content.test/api/v1/containers/${CONTAINER_ID}/versions/${VERSION_ID}/sections/reorder`,
        async ({ request }) => {
          const body = (await request.json()) as { orderedSectionIds: string[] };
          expect(body.orderedSectionIds).toEqual(['sec-2', 'sec-1']);
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    const result = await reorderSectionsAction(CONTAINER_ID, ['sec-2', 'sec-1']);

    expect(result.ok).toBe(true);
  });
});

describe('syncStructureSectionsAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes every existing section before recreating the new list', async () => {
    mockDraftVersion();
    const deleted: string[] = [];
    const created: string[] = [];

    server.use(
      http.get(
        `http://content.test/api/v1/containers/${CONTAINER_ID}/versions/${VERSION_ID}/sections`,
        () =>
          HttpResponse.json([
            { id: 'sec-old-1', containerVersionId: VERSION_ID, title: 'Old 1', position: 0 },
            { id: 'sec-old-2', containerVersionId: VERSION_ID, title: 'Old 2', position: 1 },
          ]),
      ),
      http.delete(
        `http://content.test/api/v1/containers/${CONTAINER_ID}/versions/${VERSION_ID}/sections/:sectionId`,
        ({ params }) => {
          deleted.push(params.sectionId as string);
          return new HttpResponse(null, { status: 204 });
        },
      ),
      http.post(
        `http://content.test/api/v1/containers/${CONTAINER_ID}/versions/${VERSION_ID}/sections`,
        async ({ request }) => {
          const body = (await request.json()) as { title: string };
          created.push(body.title);
          return HttpResponse.json({ sectionId: `sec-${created.length}`, position: created.length - 1 });
        },
      ),
    );

    const result = await syncStructureSectionsAction(CONTAINER_ID, ['A1', 'A2']);

    expect(result.ok).toBe(true);
    expect(deleted.sort()).toEqual(['sec-old-1', 'sec-old-2']);
    expect(created).toEqual(['A1', 'A2']);
  });

  it('deletes existing sections and creates none when titles is empty (blank mode)', async () => {
    mockDraftVersion();
    const deleted: string[] = [];

    server.use(
      http.get(
        `http://content.test/api/v1/containers/${CONTAINER_ID}/versions/${VERSION_ID}/sections`,
        () =>
          HttpResponse.json([
            { id: 'sec-old-1', containerVersionId: VERSION_ID, title: 'Old 1', position: 0 },
          ]),
      ),
      http.delete(
        `http://content.test/api/v1/containers/${CONTAINER_ID}/versions/${VERSION_ID}/sections/:sectionId`,
        ({ params }) => {
          deleted.push(params.sectionId as string);
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    const result = await syncStructureSectionsAction(CONTAINER_ID, []);

    expect(result.ok).toBe(true);
    expect(deleted).toEqual(['sec-old-1']);
  });
});
