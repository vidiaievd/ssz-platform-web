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

const { createExerciseAction } = await import('./exercise');
const { __resetExerciseTemplateCache } = await import('../lib/exercise-templates');
const { minimalExerciseValues } = await import('../lib/exercise-content');

const TEMPLATES = [
  { id: 'tpl-mc', code: 'multiple_choice' },
  { id: 'tpl-mcg', code: 'multiple_choice_group' },
];

/** Captures the bodies of the calls the action sends. */
function stubContentService() {
  const sent: { body?: Record<string, unknown>; instruction?: Record<string, unknown> } = {};
  server.use(
    http.get('http://content.test/api/v1/exercise-templates', () => HttpResponse.json(TEMPLATES)),
    http.post('http://content.test/api/v1/exercises', async ({ request }) => {
      sent.body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ exerciseId: 'ex-1' }, { status: 201 });
    }),
    http.post('http://content.test/api/v1/exercises/:id/instructions', async ({ request }) => {
      sent.instruction = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({}, { status: 201 });
    }),
    http.get('http://content.test/api/v1/containers/:id/versions', () =>
      HttpResponse.json({ items: [{ id: 'ver-1', status: 'draft' }] }),
    ),
    http.post('http://content.test/api/v1/containers/:id/versions/:versionId/items', () =>
      HttpResponse.json({ itemId: 'item-1' }, { status: 201 }),
    ),
  );
  return sent;
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetExerciseTemplateCache();
});

describe('createExerciseAction', () => {
  it('resolves the template code to its uuid and sends the built payload', async () => {
    const sent = stubContentService();

    const result = await createExerciseAction(
      'ctr-1',
      'nb',
      'A2',
      'private',
      minimalExerciseValues('multiple_choice_group', 'New exercise', 'Complete the exercise.'),
    );

    expect(result.ok).toBe(true);
    expect(sent.body).toMatchObject({
      exerciseTemplateId: 'tpl-mcg',
      targetLanguage: 'nb',
      visibility: 'private',
    });
    expect(sent.body?.content).toMatchObject({ items: [{ id: '1', question: 'New exercise' }] });
  });

  it('always writes an instruction, since an exercise without one cannot be published', async () => {
    // Pre-flight raises `EXERCISE_INCOMPLETE` as a blocker for an exercise with
    // no instruction row, and the picker creates exercises without a form.
    const sent = stubContentService();

    await createExerciseAction(
      'ctr-1',
      'nb',
      'A2',
      'private',
      minimalExerciseValues('multiple_choice', 'New exercise', 'Complete the exercise.'),
    );

    expect(sent.instruction).toMatchObject({
      instructionLanguage: 'en',
      instructionText: 'Complete the exercise.',
    });
  });

  it('sends ownerSchoolId so school_private material is accepted', async () => {
    const sent = stubContentService();

    // Without the owning school, content-service rejects `school_private` as a
    // visibility no ownerless exercise may have — a 400 on every template.
    const result = await createExerciseAction(
      'ctr-1',
      'nb',
      'A2',
      'school_private',
      minimalExerciseValues('multiple_choice', 'New exercise', 'Complete the exercise.'),
      'school-1',
    );

    expect(result.ok).toBe(true);
    expect(sent.body).toMatchObject({ visibility: 'school_private', ownerSchoolId: 'school-1' });
  });

  it('omits ownerSchoolId entirely when the course has no school', async () => {
    const sent = stubContentService();

    await createExerciseAction(
      'ctr-1',
      'nb',
      'A2',
      'private',
      minimalExerciseValues('multiple_choice', 'New exercise', 'Complete the exercise.'),
      null,
    );

    expect(sent.body).not.toHaveProperty('ownerSchoolId');
  });
});
