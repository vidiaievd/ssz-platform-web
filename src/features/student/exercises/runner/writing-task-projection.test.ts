import { describe, expect, it } from 'vitest';

import { readWritingTaskProjection } from './writing-task-projection';

const PROJECTED = {
  mode: 'letter',
  instruction: 'Skriv et brev.',
  prompt: 'Svømmehallen skal stenge.',
  letter: { recipient: 'Oslo kommune', register: 'formal' },
  points: [{ id: 'p1', text: 'Presenter deg selv', required: true }],
  phrases: ['Jeg foreslår at'],
  rubricMax: 15,
  settings: {
    minWords: 120,
    maxWords: 200,
    timer: 20,
    blockPaste: true,
    autosave: true,
    showWordCount: true,
    showPlan: true,
    showPhrases: true,
    showRubric: 'afterGraded',
    showModel: 'afterGraded',
    passScore: 8,
    revision: 'return',
  },
};

describe('readWritingTaskProjection', () => {
  it('accepts the projection and keeps the material with it', () => {
    const task = readWritingTaskProjection(PROJECTED);

    expect(task?.mode).toBe('letter');
    expect(task?.letter?.recipient).toBe('Oslo kommune');
    expect(task?.settings.minWords).toBe(120);
  });

  it('refuses a document that still carries the point keywords', () => {
    // The stored document renders just as well as the projection — that is precisely why
    // this is checked. Keywords on a point mean the server never projected, and a runner
    // that drew it anyway would be holding the answer key in the page.
    expect(
      readWritingTaskProjection({
        ...PROJECTED,
        points: [{ id: 'p1', text: 'Presenter deg selv', required: true, keywords: ['jeg heter'] }],
      }),
    ).toBeNull();
  });

  it('refuses a document that still carries the model answer', () => {
    expect(readWritingTaskProjection({ ...PROJECTED, model: 'Hei, jeg heter Anna…' })).toBeNull();
  });

  it('refuses what is not a task at all', () => {
    expect(readWritingTaskProjection(null)).toBeNull();
    expect(readWritingTaskProjection([])).toBeNull();
    expect(readWritingTaskProjection({ ...PROJECTED, prompt: '  ' })).toBeNull();
    expect(readWritingTaskProjection({ ...PROJECTED, points: undefined })).toBeNull();
    expect(readWritingTaskProjection({ ...PROJECTED, mode: 'dictation' })).toBeNull();
  });

  it('fills the settings the server left out rather than refusing a writable task', () => {
    const task = readWritingTaskProjection({ ...PROJECTED, settings: { minWords: 60 } });

    expect(task?.settings.minWords).toBe(60);
    // The author's own defaults, from the kernel — not this file's guesses.
    expect(task?.settings.showPlan).toBe(true);
    expect(task?.settings.revision).toBe('return');
  });

  it('drops the half-formed points and phrases instead of rendering holes', () => {
    const task = readWritingTaskProjection({
      ...PROJECTED,
      points: [{ id: 'p1', text: 'Presenter deg selv', required: true }, { id: 'p2' }, null],
      phrases: ['Jeg foreslår at', 42],
    });

    expect(task?.points).toHaveLength(1);
    expect(task?.phrases).toEqual(['Jeg foreslår at']);
  });

  it('derives the rubric ceiling when the server did not send it', () => {
    const task = readWritingTaskProjection({
      ...PROJECTED,
      rubricMax: undefined,
      rubric: [
        { id: 'c1', name: 'Innhold', desc: '', weight: 2, levels: ['', '', '', ''] },
        { id: 'c2', name: 'Språk', desc: '', weight: 1, levels: ['', '', '', ''] },
      ],
    });

    // 3 × 2 + 3 × 1. The graded card divides by this number, so a missing one would be a
    // score out of nothing.
    expect(task?.rubricMax).toBe(9);
  });
});
