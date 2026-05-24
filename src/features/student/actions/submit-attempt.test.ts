// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

// Mock Next.js server modules before importing the action.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Mock serverFetch so we can control what the Exercise Engine returns.
const mockServerFetch = vi.fn();
vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: (...args: unknown[]) => mockServerFetch(...args),
}));

const { submitAttemptAction } = await import('./submit-attempt');

const EX_ID = 'ex-1';
const ATTEMPT_ID = 'attempt-abc';

function mockBackend(submitResponse: object) {
  mockServerFetch
    .mockResolvedValueOnce({ attemptId: ATTEMPT_ID, exerciseId: EX_ID, startedAt: '2025-01-01T00:00:00Z' })
    .mockResolvedValueOnce(submitResponse);
}

describe('submitAttemptAction — cloze', () => {
  it('returns correct when backend returns correct verdict', async () => {
    mockBackend({ verdict: 'correct' });
    const res = await submitAttemptAction({ exerciseId: EX_ID, type: 'cloze', answer: ['sykler', 'bussen'] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('correct');
    expect(res.value.canRetry).toBe(false);
  });

  it('returns partial with correctAnswer when backend returns partial verdict', async () => {
    mockBackend({ verdict: 'partial', correctAnswer: ['sykler', 'bussen'] });
    const res = await submitAttemptAction({ exerciseId: EX_ID, type: 'cloze', answer: ['sykler', 'toget'] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('partial');
    expect(res.value.canRetry).toBe(true);
    expect(res.value.correctAnswer).toEqual(['sykler', 'bussen']);
  });

  it('returns incorrect with correctAnswer when backend returns incorrect verdict', async () => {
    mockBackend({ verdict: 'incorrect', correctAnswer: ['sykler', 'bussen'] });
    const res = await submitAttemptAction({ exerciseId: EX_ID, type: 'cloze', answer: ['toget', 'bilen'] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('incorrect');
    expect(res.value.canRetry).toBe(true);
  });
});

describe('submitAttemptAction — multiple_choice', () => {
  it('returns correct verdict from backend', async () => {
    mockBackend({ verdict: 'correct' });
    const res = await submitAttemptAction({ exerciseId: EX_ID, type: 'multiple_choice', answer: 1 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('correct');
    expect(res.value.canRetry).toBe(false);
  });

  it('returns incorrect with explanation from backend', async () => {
    mockBackend({ verdict: 'incorrect', correctAnswer: 'Blue', explanation: 'Rayleigh scattering.' });
    const res = await submitAttemptAction({ exerciseId: EX_ID, type: 'multiple_choice', answer: 0 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('incorrect');
    expect(res.value.correctAnswer).toBe('Blue');
    expect(res.value.explanation).toBe('Rayleigh scattering.');
    expect(res.value.canRetry).toBe(true);
  });
});

describe('submitAttemptAction — free_text', () => {
  it('sets requiresReview=true and canRetry=false when backend flags review', async () => {
    mockBackend({ verdict: 'partial', requiresReview: true });
    const res = await submitAttemptAction({ exerciseId: EX_ID, type: 'free_text', answer: 'Jeg heter Ola.' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.requiresReview).toBe(true);
    expect(res.value.canRetry).toBe(false);
  });

  it('returns partial with correctAnswer when backend returns sample answer', async () => {
    mockBackend({ verdict: 'partial', correctAnswer: 'Jeg heter Ola.' });
    const res = await submitAttemptAction({ exerciseId: EX_ID, type: 'free_text', answer: 'something' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('partial');
    expect(res.value.correctAnswer).toBe('Jeg heter Ola.');
  });
});

describe('submitAttemptAction — pronunciation', () => {
  it('returns validation error without calling the backend', async () => {
    mockServerFetch.mockClear();
    const res = await submitAttemptAction({ exerciseId: EX_ID, type: 'pronunciation', answer: null });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('validation');
    expect(mockServerFetch).not.toHaveBeenCalled();
  });
});

describe('submitAttemptAction — backend failures', () => {
  it('returns unknown error when start attempt gives malformed response', async () => {
    mockServerFetch.mockResolvedValueOnce({ unexpected: true });
    const res = await submitAttemptAction({ exerciseId: EX_ID, type: 'cloze', answer: ['x'] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('unknown');
  });

  it('returns unknown error when submit gives malformed response', async () => {
    mockServerFetch
      .mockResolvedValueOnce({ attemptId: ATTEMPT_ID, exerciseId: EX_ID, startedAt: '2025-01-01T00:00:00Z' })
      .mockResolvedValueOnce({ unexpected: true });
    const res = await submitAttemptAction({ exerciseId: EX_ID, type: 'cloze', answer: ['x'] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('unknown');
  });
});
