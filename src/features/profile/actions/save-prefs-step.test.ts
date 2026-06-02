// @vitest-environment node

import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: vi.fn(() => ({ value: 'test-token' })),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: async () => new Headers(),
}));

const { saveTutorStepAction, savePrefsStepAction, skipPrefsStepAction } =
  await import('./save-prefs-step');

const VALID_TUTOR_INPUT = {
  teachingLanguages: [{ code: 'nb', proficiency: 'FLUENT' as const }],
  hourlyRate: null,
  specializations: [],
};

const EMPTY_TUTOR_INPUT = {
  teachingLanguages: [],
  hourlyRate: null,
  specializations: [],
};

describe('saveTutorStepAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs to create the tutor profile on success', async () => {
    let method = '';
    server.use(
      http.post('http://profile.test/api/v1/profiles/me/tutor', ({ request }) => {
        method = request.method;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const result = await saveTutorStepAction(VALID_TUTOR_INPUT);

    expect(result.ok).toBe(true);
    expect(method).toBe('POST');
  });

  it('falls back to PATCH when POST returns 409 (profile already exists)', async () => {
    const methods: string[] = [];
    server.use(
      http.post('http://profile.test/api/v1/profiles/me/tutor', () => {
        methods.push('POST');
        return HttpResponse.json({ title: 'Conflict' }, { status: 409 });
      }),
      http.patch('http://profile.test/api/v1/profiles/me/tutor', () => {
        methods.push('PATCH');
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const result = await saveTutorStepAction(VALID_TUTOR_INPUT);

    expect(result.ok).toBe(true);
    expect(methods).toEqual(['POST', 'PATCH']);
  });

  it('propagates errors other than 409 without retrying', async () => {
    server.use(
      http.post('http://profile.test/api/v1/profiles/me/tutor', () =>
        HttpResponse.json({ title: 'Server error' }, { status: 500 }),
      ),
    );

    const result = await saveTutorStepAction(VALID_TUTOR_INPUT);

    expect(result.ok).toBe(false);
  });

  it('accepts empty teachingLanguages (step is optional)', async () => {
    server.use(
      http.post('http://profile.test/api/v1/profiles/me/tutor', () =>
        HttpResponse.json({}, { status: 201 }),
      ),
    );

    const result = await saveTutorStepAction(EMPTY_TUTOR_INPUT);

    expect(result.ok).toBe(true);
  });

  it('returns validation error for invalid proficiency level without hitting the network', async () => {
    const result = await saveTutorStepAction({
      teachingLanguages: [{ code: 'nb', proficiency: 'INVALID' as never }],
      hourlyRate: null,
      specializations: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
  });
});

describe('savePrefsStepAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs to create the student profile', async () => {
    let method = '';
    server.use(
      http.post('http://profile.test/api/v1/profiles/me/student', ({ request }) => {
        method = request.method;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const result = await savePrefsStepAction({
      nativeLanguage: 'en',
      targetLanguages: [{ code: 'nb', level: 'A1' }],
    });

    expect(result.ok).toBe(true);
    expect(method).toBe('POST');
  });

  it('treats 409 from student profile as success (profile already exists)', async () => {
    server.use(
      http.post('http://profile.test/api/v1/profiles/me/student', () =>
        HttpResponse.json({ title: 'Conflict' }, { status: 409 }),
      ),
    );

    const result = await savePrefsStepAction({
      nativeLanguage: 'en',
      targetLanguages: [],
    });

    expect(result.ok).toBe(true);
  });
});

describe('skipPrefsStepAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs empty preferences to create student profile', async () => {
    let body: unknown;
    server.use(
      http.post('http://profile.test/api/v1/profiles/me/student', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const result = await skipPrefsStepAction();

    expect(result.ok).toBe(true);
    expect(body).toMatchObject({ nativeLanguage: null, targetLanguages: [] });
  });
});
