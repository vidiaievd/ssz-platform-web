import {
  channelsOf,
  elementsOf,
  matches,
  type RecipeElement,
  type RecipeRule,
} from '@/lib/shared-kernel/skills';

import {
  EXERCISE_TYPES,
  RETIRED_EXERCISE_TYPES,
  type ExerciseTypeDefinition,
} from './exercise-type-registry';

/**
 * Which types would close a rule a lesson fails — plan 64, decisions L and Q.
 *
 * The rule speaks axes; the author thinks in types. This is the one translation between
 * the two, and it is computed rather than written down: a live type is judged by the
 * kernel exactly as its exercises are, so a type re-judged in `by-template.ts` changes
 * the advice the same day, and a planned type by the axes the catalogue claims for it.
 */
export interface Remedies {
  /** Types an author can add today, in catalogue order. */
  live: ExerciseTypeDefinition[];
  /** Types the catalogue has written down and nobody has built — shown as "soon". */
  planned: ExerciseTypeDefinition[];
  /**
   * Whether turning on the recording of an existing exercise would do it. True for the
   * listening rules, which no bare template satisfies: every live type is read, and the
   * audio layer (plan 56) is what makes any of them heard.
   */
  audioLayer: boolean;
}

/**
 * The documents that change what a template trains. A template whose document decides
 * (`word_bank_gap_fill`: picked off a strip, or typed from nothing) is judged in each of
 * its modes rather than in neither, or it would never be advised at all.
 */
const MODES: Readonly<Record<string, readonly unknown[]>> = {
  word_bank_gap_fill: [{ settings: { input: 'free' } }, { settings: { input: 'bank' } }],
};

function liveElements(code: string, content?: unknown): RecipeElement[] {
  const contents = content === undefined ? (MODES[code] ?? [undefined]) : [content];
  return contents.flatMap((c) => elementsOf({ templateCode: code, content: c }));
}

function plannedElement(type: ExerciseTypeDefinition): RecipeElement | null {
  if (!type.axes) return null;
  const { input, output, modality, focus = [] } = type.axes;
  return { exerciseIndex: 0, input, output, modality, skills: channelsOf(input, output), focus };
}

/**
 * Whether adding one of these would help: for a floor, an element the rule counts; for a
 * ceiling, one it does not — adding more of what the rule caps only makes it worse.
 */
function helps(element: RecipeElement, rule: RecipeRule): boolean {
  const counted = matches(element, rule);
  return rule.min !== undefined ? counted : !counted;
}

export function remediesFor(rule: RecipeRule): Remedies {
  const live: ExerciseTypeDefinition[] = [];
  const planned: ExerciseTypeDefinition[] = [];
  let audioLayer = false;

  for (const type of Object.values(EXERCISE_TYPES)) {
    if (type.status === 'planned') {
      const element = plannedElement(type);
      if (element && helps(element, rule)) planned.push(type);
      continue;
    }
    if (RETIRED_EXERCISE_TYPES.has(type.code)) continue;

    if (liveElements(type.code).some((element) => helps(element, rule))) {
      live.push(type);
    } else if (
      rule.min !== undefined &&
      liveElements(type.code, { audio: { enabled: true } }).some((element) => helps(element, rule))
    ) {
      audioLayer = true;
    }
  }

  return { live, planned, audioLayer };
}
