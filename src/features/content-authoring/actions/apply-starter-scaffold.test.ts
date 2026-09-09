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

const { applyCefrStarterScaffoldAction } = await import('./apply-starter-scaffold');
const { __resetExerciseTemplateCache } = await import('../lib/exercise-templates');

const TITLES = {
  module: 'A1 Starter',
  vocabulary: 'Vocabulary',
  reading: 'Reading',
  listening: 'Listening',
  practiceInstructions: 'Choose the correct answer.',
};

const DRAFT_VERSION = {
  items: [{ id: 'v-draft', status: 'draft', containerId: 'x', createdAt: '2025-01-01T00:00:00Z' }],
};
// The real backend's POST .../items responds with { itemId, position } —
// `itemId` here means "id of the newly created container-item", not "id of
// the referenced content" as it does in the GET list response.
const ADD_ITEM_RESPONSE = { itemId: 'item-1', position: 0 };

function mockHappyPath() {
  server.use(
    http.post('http://content.test/api/v1/containers', () =>
      HttpResponse.json(
        {
          id: 'mod-1',
          slug: null,
          title: TITLES.module,
          containerType: 'module',
          targetLanguage: 'nb',
          difficultyLevel: 'A1',
          visibility: 'public',
          accessTier: 'public_free',
          ownerUserId: 'user-1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        { status: 201 },
      ),
    ),
    http.get('http://content.test/api/v1/containers/:id/versions', () =>
      HttpResponse.json(DRAFT_VERSION),
    ),
    http.post('http://content.test/api/v1/containers/:id/versions/:versionId/items', () =>
      HttpResponse.json(ADD_ITEM_RESPONSE, { status: 201 }),
    ),
    http.post('http://content.test/api/v1/vocabulary-lists', () =>
      HttpResponse.json({ listId: 'voc-1' }, { status: 201 }),
    ),
    http.post('http://content.test/api/v1/lessons', () =>
      HttpResponse.json({ lessonId: 'lsn-1' }, { status: 201 }),
    ),
    http.get('http://content.test/api/v1/exercise-templates', () =>
      HttpResponse.json([
        {
          id: 'tpl-mcq',
          code: 'multiple_choice',
          name: 'Multiple Choice',
          contentSchema: {},
          answerSchema: {},
          isActive: true,
        },
      ]),
    ),
    http.post('http://content.test/api/v1/exercises', () =>
      HttpResponse.json({ exerciseId: 'exc-1' }, { status: 201 }),
    ),
    // The starter exercise gets an instruction of its own — without one it
    // would be a publish blocker the moment the course is created.
    http.post('http://content.test/api/v1/exercises/:id/instructions', () =>
      HttpResponse.json({}, { status: 201 }),
    ),
  );
}

describe('applyCefrStarterScaffoldAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetExerciseTemplateCache();
  });

  it('creates a module with vocabulary, reading, listening and practice items', async () => {
    mockHappyPath();

    const result = await applyCefrStarterScaffoldAction(
      'course-1',
      'nb',
      'public',
      'public_free',
      null,
      TITLES,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.moduleContainerId).toBe('mod-1');
  });

  // Plan 53 §8 Q5: the starter used to seed its practice exercise through the generic
  // form, which wrote the old single-question shape — a document the multiple-choice
  // builder never opens. It is created from that builder's own scaffold now, and the test
  // asks the payload rather than the call, because the shape is the whole point.
  it('seeds the practice exercise as a multiple-choice set, not a single question', async () => {
    mockHappyPath();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post('http://content.test/api/v1/exercises', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ exerciseId: 'exc-1' }, { status: 201 });
      }),
    );

    await applyCefrStarterScaffoldAction('course-1', 'nb', 'public', 'public_free', null, TITLES);

    expect(body).not.toBeNull();
    const content = (body as unknown as { content: Record<string, unknown> }).content;
    expect(Array.isArray(content.questions)).toBe(true);
    expect(content.question).toBeUndefined();
    expect(content.instruction).toBe(TITLES.practiceInstructions);
  });

  it('propagates the underlying error code when module creation fails', async () => {
    server.use(
      http.post('http://content.test/api/v1/containers', () =>
        HttpResponse.json({ title: 'Internal Server Error' }, { status: 500 }),
      ),
    );

    const result = await applyCefrStarterScaffoldAction(
      'course-1',
      'nb',
      'public',
      'public_free',
      null,
      TITLES,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('upstream_unavailable');
  });

  it('propagates the error when a later step (the exercise) fails', async () => {
    mockHappyPath();
    server.use(
      http.post('http://content.test/api/v1/exercises', () =>
        HttpResponse.json({ title: 'Internal Server Error' }, { status: 500 }),
      ),
    );

    const result = await applyCefrStarterScaffoldAction(
      'course-1',
      'nb',
      'public',
      'public_free',
      null,
      TITLES,
    );

    expect(result.ok).toBe(false);
  });
});
