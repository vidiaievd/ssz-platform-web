import { describe, expect, it } from 'vitest';

import {
  emptyContent,
  LEN_DEFAULTS,
  rubricMax,
  type WritingTask,
} from '@/lib/shared-kernel/writing-task';

import {
  addCriterion,
  addKeyword,
  addPhrase,
  addPoint,
  isDefaultRange,
  MAX_CRITERIA,
  MAX_POINTS,
  removeCriterion,
  removeKeyword,
  removePhrase,
  removePoint,
  resetRange,
  setCriterion,
  setLevel,
  setMode,
  setPoint,
  setSettings,
} from './edits';

function doc(overrides: Partial<WritingTask> = {}): WritingTask {
  return {
    id: 'ex-1',
    type: 'writing_task',
    moduleId: 'module-1',
    title: '',
    updatedAt: '2026-08-22T10:00:00.000Z',
    ...emptyContent(),
    ...overrides,
  };
}

describe('setMode', () => {
  it('resets the word range to the new mode default', () => {
    const next = setMode(doc(), 'essay');

    expect([next.settings.minWords, next.settings.maxWords]).toEqual([...LEN_DEFAULTS.essay]);
  });

  it('keeps every text field the author wrote', () => {
    const before = doc({
      prompt: 'Du har flyttet til en ny by.',
      source: 'En kort artikkel.',
      letter: { register: 'informal', recipient: 'En venn' },
    });

    const next = setMode(before, 'picture');

    expect(next.prompt).toBe(before.prompt);
    expect(next.source).toBe(before.source);
    expect(next.letter).toEqual(before.letter);
  });
});

describe('the word range', () => {
  it('is at its default until the author moves it', () => {
    const letter = doc();

    expect(isDefaultRange(letter)).toBe(true);
    expect(isDefaultRange(setSettings(letter, { minWords: 60 }))).toBe(false);
  });

  it('goes back to the mode default on reset', () => {
    const moved = setSettings(setMode(doc(), 'retell'), { minWords: 10, maxWords: 20 });

    const next = resetRange(moved);

    expect([next.settings.minWords, next.settings.maxWords]).toEqual([...LEN_DEFAULTS.retell]);
  });
});

describe('points', () => {
  it('stops adding at the maximum', () => {
    let exercise = doc();
    for (let i = 0; i < MAX_POINTS + 3; i += 1) exercise = addPoint(exercise);

    expect(exercise.points).toHaveLength(MAX_POINTS);
  });

  it('never removes the last one — no usable point is a blocker', () => {
    const single = doc();

    expect(removePoint(single, single.points[0]!.id).points).toHaveLength(1);
  });

  it('removes a point when there is another', () => {
    const two = addPoint(doc());

    expect(removePoint(two, two.points[0]!.id).points).toEqual([two.points[1]]);
  });

  it('ignores a blank or duplicate keyword', () => {
    const before = doc();
    const id = before.points[0]!.id;
    const one = addKeyword(before, id, '  ny by  ');

    expect(one.points[0]!.keywords).toEqual(['ny by']);
    expect(addKeyword(one, id, 'ny by').points[0]!.keywords).toEqual(['ny by']);
    expect(addKeyword(one, id, '   ').points[0]!.keywords).toEqual(['ny by']);
  });

  it('removes a keyword by its text', () => {
    const before = doc();
    const id = before.points[0]!.id;
    const two = addKeyword(addKeyword(before, id, 'ny by'), id, 'flyttet');

    expect(removeKeyword(two, id, 'ny by').points[0]!.keywords).toEqual(['flyttet']);
  });

  it('edits one point and leaves the others alone', () => {
    const two = addPoint(doc());

    const next = setPoint(two, two.points[1]!.id, { text: 'Fortell om jobben', required: false });

    expect(next.points[0]).toEqual(two.points[0]);
    expect(next.points[1]).toMatchObject({ text: 'Fortell om jobben', required: false });
  });
});

describe('phrases', () => {
  it('trims, and refuses blanks and duplicates', () => {
    const one = addPhrase(doc(), '  Jeg synes at…  ');

    expect(one.phrases).toEqual(['Jeg synes at…']);
    expect(addPhrase(one, 'Jeg synes at…').phrases).toEqual(['Jeg synes at…']);
    expect(addPhrase(one, ' ').phrases).toEqual(['Jeg synes at…']);
    expect(removePhrase(one, 'Jeg synes at…').phrases).toEqual([]);
  });
});

describe('rubric', () => {
  it('adds a criterion with no metric and no descriptors', () => {
    const next = addCriterion(doc());
    const added = next.rubric.at(-1)!;

    expect(added).toMatchObject({ name: '', desc: '', weight: 1, metric: null });
    expect(added.levels).toEqual(['', '', '', '']);
  });

  it('stops adding at the maximum', () => {
    let exercise = doc();
    for (let i = 0; i < MAX_CRITERIA + 3; i += 1) exercise = addCriterion(exercise);

    expect(exercise.rubric).toHaveLength(MAX_CRITERIA);
  });

  it('never removes below two', () => {
    let exercise = doc();
    while (exercise.rubric.length > 2) {
      exercise = removeCriterion(exercise, exercise.rubric[0]!.id);
    }

    expect(removeCriterion(exercise, exercise.rubric[0]!.id).rubric).toHaveLength(2);
  });

  it('brings passScore down with the ceiling it no longer fits under', () => {
    // The default rubric is 2+1+1+1 weights → 15. Dropping the ×2 criterion leaves 9.
    const before = setSettings(doc(), { passScore: 14 });

    const next = removeCriterion(before, before.rubric[0]!.id);

    expect(rubricMax(next)).toBe(9);
    expect(next.settings.passScore).toBe(9);
  });

  it('leaves a threshold that still fits where the author put it', () => {
    const before = setSettings(doc(), { passScore: 5 });

    expect(removeCriterion(before, before.rubric[0]!.id).settings.passScore).toBe(5);
  });

  it('writes one level descriptor by index', () => {
    const before = doc();
    const [zero, one, two] = before.rubric[1]!.levels;

    const next = setLevel(before, before.rubric[1]!.id, 3, 'Tydelig struktur');

    expect(next.rubric[1]!.levels).toEqual([zero, one, two, 'Tydelig struktur']);
    expect(next.rubric[0]).toEqual(before.rubric[0]);
  });

  it('edits one criterion and leaves the others alone', () => {
    const before = doc();

    const next = setCriterion(before, before.rubric[2]!.id, { weight: 2, metric: 'lexis' });

    expect(next.rubric[0]).toEqual(before.rubric[0]);
    expect(next.rubric[2]).toMatchObject({ weight: 2, metric: 'lexis' });
  });
});
