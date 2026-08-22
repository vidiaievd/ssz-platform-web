// Editing operations on a `writing_task` document, for the builder.
//
// Everything here is pure: document in, document out. The derived side — what a text
// measures, what is wrong with the document, what the student would be sent — belongs to
// `@/lib/shared-kernel/writing-task` and is never recomputed here. This file only
// rewrites what the author typed.

import {
  LEN_DEFAULTS,
  newPoint,
  type Criterion,
  type Mode,
  type Point,
  type Settings,
  type WritingTask,
} from '@/lib/shared-kernel/writing-task';

/** Points and criteria beyond these counts stop being a task and start being a form. */
export const MAX_POINTS = 6;
export const MIN_CRITERIA = 2;
export const MAX_CRITERIA = 6;

/** Only has to be unique within one exercise and stable across the edit session. */
export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Switch the mode, keeping every text field and resetting the word range.
 *
 * README, "Why picture is a mode": an author who mislabels a task and fixes it must not
 * lose the prompt, so nothing written is cleared — the unused material simply stops being
 * shown and stops being validated. The range *is* reset, because 200–350 words carried
 * over from an essay onto a picture description is a number nobody chose.
 */
export function setMode(exercise: WritingTask, mode: Mode): WritingTask {
  const [minWords, maxWords] = LEN_DEFAULTS[mode];
  return { ...exercise, mode, settings: { ...exercise.settings, minWords, maxWords } };
}

/** Whether the word range still says what this mode's default says. Drives the reset offer. */
export function isDefaultRange(exercise: WritingTask): boolean {
  const [minWords, maxWords] = LEN_DEFAULTS[exercise.mode];
  return exercise.settings.minWords === minWords && exercise.settings.maxWords === maxWords;
}

export function resetRange(exercise: WritingTask): WritingTask {
  const [minWords, maxWords] = LEN_DEFAULTS[exercise.mode];
  return { ...exercise, settings: { ...exercise.settings, minWords, maxWords } };
}

export function setSettings(exercise: WritingTask, patch: Partial<Settings>): WritingTask {
  return { ...exercise, settings: { ...exercise.settings, ...patch } };
}

export function setAi(exercise: WritingTask, patch: Partial<Settings['ai']>): WritingTask {
  return {
    ...exercise,
    settings: { ...exercise.settings, ai: { ...exercise.settings.ai, ...patch } },
  };
}

// ── Must-cover points ───────────────────────────────────────────────────────

export type PointPatch = Partial<Pick<Point, 'text' | 'keywords' | 'required'>>;

export function setPoint(exercise: WritingTask, pointId: string, patch: PointPatch): WritingTask {
  return {
    ...exercise,
    points: exercise.points.map((point) => (point.id === pointId ? { ...point, ...patch } : point)),
  };
}

/** A new empty row, up to `MAX_POINTS`. Beyond that the document is returned untouched. */
export function addPoint(exercise: WritingTask): WritingTask {
  if (exercise.points.length >= MAX_POINTS) return exercise;
  return { ...exercise, points: [...exercise.points, newPoint()] };
}

/**
 * Remove a point, never the last one.
 *
 * "No usable point" is a blocker, and a builder that let the author delete their way into
 * it would be offering a button whose only effect is a red dot on the rail. The row's
 * delete is disabled at one; this is the same rule where it cannot be bypassed.
 */
export function removePoint(exercise: WritingTask, pointId: string): WritingTask {
  if (exercise.points.length <= 1) return exercise;
  return { ...exercise, points: exercise.points.filter((point) => point.id !== pointId) };
}

/** Add a keyword to a point, trimmed, ignoring blanks and ones already there. */
export function addKeyword(exercise: WritingTask, pointId: string, keyword: string): WritingTask {
  const value = keyword.trim();
  if (value === '') return exercise;
  const point = exercise.points.find((p) => p.id === pointId);
  if (!point || point.keywords.includes(value)) return exercise;
  return setPoint(exercise, pointId, { keywords: [...point.keywords, value] });
}

export function removeKeyword(
  exercise: WritingTask,
  pointId: string,
  keyword: string,
): WritingTask {
  const point = exercise.points.find((p) => p.id === pointId);
  if (!point) return exercise;
  return setPoint(exercise, pointId, { keywords: point.keywords.filter((k) => k !== keyword) });
}

// ── Useful phrases ──────────────────────────────────────────────────────────

export function addPhrase(exercise: WritingTask, phrase: string): WritingTask {
  const value = phrase.trim();
  if (value === '' || exercise.phrases.includes(value)) return exercise;
  return { ...exercise, phrases: [...exercise.phrases, value] };
}

export function removePhrase(exercise: WritingTask, phrase: string): WritingTask {
  return { ...exercise, phrases: exercise.phrases.filter((p) => p !== phrase) };
}

// ── Rubric ──────────────────────────────────────────────────────────────────

export type CriterionPatch = Partial<Pick<Criterion, 'name' | 'desc' | 'weight' | 'metric'>>;

export function setCriterion(
  exercise: WritingTask,
  criterionId: string,
  patch: CriterionPatch,
): WritingTask {
  return {
    ...exercise,
    rubric: exercise.rubric.map((c) => (c.id === criterionId ? { ...c, ...patch } : c)),
  };
}

/** One level descriptor, by its 0–3 index. */
export function setLevel(
  exercise: WritingTask,
  criterionId: string,
  level: 0 | 1 | 2 | 3,
  text: string,
): WritingTask {
  return {
    ...exercise,
    rubric: exercise.rubric.map((c) => {
      if (c.id !== criterionId) return c;
      const levels: [string, string, string, string] = [...c.levels];
      levels[level] = text;
      return { ...c, levels };
    }),
  };
}

/**
 * A new criterion, up to `MAX_CRITERIA`.
 *
 * It arrives with `metric: null` and empty descriptors — no suggestion rather than a
 * borrowed one. A criterion the author invented has no measurable proxy until they say
 * which one it is, and guessing from its position is the prototype shortcut plan 50 §3.4
 * exists to avoid.
 */
export function addCriterion(exercise: WritingTask): WritingTask {
  if (exercise.rubric.length >= MAX_CRITERIA) return exercise;
  const criterion: Criterion = {
    id: newId(),
    name: '',
    desc: '',
    weight: 1,
    levels: ['', '', '', ''],
    metric: null,
  };
  return { ...exercise, rubric: [...exercise.rubric, criterion] };
}

/**
 * Remove a criterion, never below `MIN_CRITERIA`, and keep `passScore` reachable.
 *
 * Dropping a criterion lowers the maximum, and a threshold left above it is a blocker the
 * author did not cause and would have to be told about — so the threshold follows the
 * ceiling down. Raising the ceiling again never moves it back: that number is a decision.
 */
export function removeCriterion(exercise: WritingTask, criterionId: string): WritingTask {
  if (exercise.rubric.length <= MIN_CRITERIA) return exercise;
  const rubric = exercise.rubric.filter((c) => c.id !== criterionId);
  const max = rubric.reduce((sum, c) => sum + 3 * c.weight, 0);
  return {
    ...exercise,
    rubric,
    settings: { ...exercise.settings, passScore: Math.min(exercise.settings.passScore, max) },
  };
}
