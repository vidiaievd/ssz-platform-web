// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

// Mock Next.js server modules before importing the action.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'en' }));

// Mock serverFetch so we can control what the Exercise Engine returns.
const mockServerFetch = vi.fn();
vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: (...args: unknown[]) => mockServerFetch(...args),
}));

const { submitAttemptAction } = await import('./submit-attempt');

const EX_ID = 'ex-1';
const ATTEMPT_ID = 'attempt-abc';
const BASE_INPUT = { exerciseId: EX_ID, timeSpentSeconds: 12 };

function mockBackend(submitResponse: {
  correct: boolean;
  requiresReview?: boolean;
  score?: number | null;
  feedback?: { summary?: string; hints?: string[]; correctAnswer?: unknown };
}) {
  mockServerFetch
    .mockResolvedValueOnce({ attemptId: ATTEMPT_ID })
    .mockResolvedValueOnce({
      requiresReview: false,
      score: null,
      feedback: { summary: '' },
      ...submitResponse,
    });
}

describe('submitAttemptAction — cloze', () => {
  it('returns correct when the engine marks the answer correct', async () => {
    mockBackend({ correct: true });
    const res = await submitAttemptAction({ ...BASE_INPUT, type: 'cloze', answer: ['sykler', 'bussen'] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('correct');
    expect(res.value.canRetry).toBe(false);
  });

  it('returns incorrect with the canonical answer when the engine marks it wrong', async () => {
    mockBackend({ correct: false, feedback: { summary: '', correctAnswer: ['sykler', 'bussen'] } });
    const res = await submitAttemptAction({ ...BASE_INPUT, type: 'cloze', answer: ['sykler', 'toget'] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('incorrect');
    expect(res.value.canRetry).toBe(true);
    expect(res.value.correctAnswer).toEqual(['sykler', 'bussen']);
  });
});

describe('submitAttemptAction — multiple_choice', () => {
  it('returns correct verdict from backend', async () => {
    mockBackend({ correct: true });
    const res = await submitAttemptAction({ ...BASE_INPUT, type: 'multiple_choice', answer: 1 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('correct');
    expect(res.value.canRetry).toBe(false);
  });

  it('returns incorrect with explanation from backend', async () => {
    mockBackend({ correct: false, feedback: { summary: 'Rayleigh scattering.', correctAnswer: 'Blue' } });
    const res = await submitAttemptAction({ ...BASE_INPUT, type: 'multiple_choice', answer: 0 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('incorrect');
    expect(res.value.correctAnswer).toBe('Blue');
    expect(res.value.explanation).toBe('Rayleigh scattering.');
    expect(res.value.canRetry).toBe(true);
  });
});

describe('submitAttemptAction — free_text', () => {
  it('sets verdict=partial, requiresReview=true and canRetry=false when routed for human review', async () => {
    mockBackend({ correct: false, requiresReview: true, feedback: { summary: 'Submitted for review.' } });
    const res = await submitAttemptAction({ ...BASE_INPUT, type: 'free_text', answer: 'Jeg heter Ola.' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('partial');
    expect(res.value.requiresReview).toBe(true);
    expect(res.value.canRetry).toBe(false);
  });
});

describe('submitAttemptAction — pronunciation', () => {
  it('returns validation error without calling the backend', async () => {
    mockServerFetch.mockClear();
    const res = await submitAttemptAction({ ...BASE_INPUT, type: 'pronunciation', answer: null });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('validation');
    expect(mockServerFetch).not.toHaveBeenCalled();
  });
});

describe('submitAttemptAction — request shape', () => {
  it('sends language, assignmentId and a rounded non-negative timeSpentSeconds', async () => {
    mockBackend({ correct: true });
    await submitAttemptAction({
      ...BASE_INPUT,
      type: 'multiple_choice',
      answer: 1,
      timeSpentSeconds: 7.6,
      assignmentId: 'assignment-1',
    });

    expect(mockServerFetch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: `/exercises/${EX_ID}/attempts`,
        method: 'POST',
        body: { language: 'en', assignmentId: 'assignment-1' },
      }),
    );
    expect(mockServerFetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: `/exercises/${EX_ID}/attempts/${ATTEMPT_ID}/submit`,
        method: 'POST',
        body: { submittedAnswer: 1, timeSpentSeconds: 8, locale: 'en' },
      }),
    );
  });
});

describe('submitAttemptAction — backend failures', () => {
  it('returns unknown error when start attempt gives malformed response', async () => {
    mockServerFetch.mockResolvedValueOnce({ unexpected: true });
    const res = await submitAttemptAction({ ...BASE_INPUT, type: 'cloze', answer: ['x'] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('unknown');
  });

  it('returns unknown error when submit gives malformed response', async () => {
    mockServerFetch
      .mockResolvedValueOnce({ attemptId: ATTEMPT_ID })
      .mockResolvedValueOnce({ unexpected: true });
    const res = await submitAttemptAction({ ...BASE_INPUT, type: 'cloze', answer: ['x'] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('unknown');
  });
});
