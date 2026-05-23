// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { submitAttemptAction } = await import('./submit-attempt');

const EX_ID = 'ex-1';

describe('submitAttemptAction — cloze', () => {
  const content = { answers: ['sykler', 'bussen'], template: 'Jeg ___ og tar ___.' };

  it('returns correct when all blanks match (case-insensitive)', async () => {
    const res = await submitAttemptAction({
      exerciseId: EX_ID,
      type: 'cloze',
      answer: ['Sykler', 'BUSSEN'],
      content,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('correct');
    expect(res.value.canRetry).toBe(false);
  });

  it('returns partial when some blanks match', async () => {
    const res = await submitAttemptAction({
      exerciseId: EX_ID,
      type: 'cloze',
      answer: ['sykler', 'toget'],
      content,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('partial');
    expect(res.value.canRetry).toBe(true);
    expect(res.value.correctAnswer).toEqual(['sykler', 'bussen']);
  });

  it('returns incorrect when no blanks match', async () => {
    const res = await submitAttemptAction({
      exerciseId: EX_ID,
      type: 'cloze',
      answer: ['toget', 'bilen'],
      content,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('incorrect');
    expect(res.value.canRetry).toBe(true);
  });

  it('returns a validation error when answer is not an array', async () => {
    const res = await submitAttemptAction({
      exerciseId: EX_ID,
      type: 'cloze',
      answer: 'wrong',
      content,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('validation');
  });
});

describe('submitAttemptAction — multiple_choice', () => {
  const content = {
    question: 'What colour is the sky?',
    options: ['Red', 'Blue', 'Green'],
    correctIndex: 1,
    explanation: 'The sky appears blue due to Rayleigh scattering.',
  };

  it('returns correct for the right index', async () => {
    const res = await submitAttemptAction({
      exerciseId: EX_ID,
      type: 'multiple_choice',
      answer: 1,
      content,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('correct');
    expect(res.value.canRetry).toBe(false);
  });

  it('returns incorrect for a wrong index and includes explanation', async () => {
    const res = await submitAttemptAction({
      exerciseId: EX_ID,
      type: 'multiple_choice',
      answer: 0,
      content,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('incorrect');
    expect(res.value.correctAnswer).toBe('Blue');
    expect(res.value.explanation).toBe(content.explanation);
    expect(res.value.canRetry).toBe(true);
  });

  it('returns a validation error when answer is not a number', async () => {
    const res = await submitAttemptAction({
      exerciseId: EX_ID,
      type: 'multiple_choice',
      answer: 'Blue',
      content,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('validation');
  });
});

describe('submitAttemptAction — free_text', () => {
  it('always returns partial with the sample answer', async () => {
    const res = await submitAttemptAction({
      exerciseId: EX_ID,
      type: 'free_text',
      answer: 'anything the student writes',
      content: { prompt: 'Describe yourself.', sampleAnswer: 'Jeg heter Ola.' },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.verdict).toBe('partial');
    expect(res.value.correctAnswer).toBe('Jeg heter Ola.');
    expect(res.value.canRetry).toBe(true);
  });

  it('omits correctAnswer when sampleAnswer is absent', async () => {
    const res = await submitAttemptAction({
      exerciseId: EX_ID,
      type: 'free_text',
      answer: 'something',
      content: { prompt: 'Describe yourself.' },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.correctAnswer).toBeUndefined();
  });
});

describe('submitAttemptAction — pronunciation', () => {
  it('returns a validation error (handled in VoxOrd)', async () => {
    const res = await submitAttemptAction({
      exerciseId: EX_ID,
      type: 'pronunciation',
      answer: null,
      content: { text: 'Hei', ipa: '/hæɪ/' },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('validation');
  });
});
