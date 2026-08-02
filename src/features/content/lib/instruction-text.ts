import type { ExerciseInstruction } from '../types';

/**
 * The primary instruction text for an exercise. The backend models instructions
 * as a per-language sub-resource list; consumers that show a single line take
 * the first entry (server orders by preferred language).
 */
export function primaryInstructionText(
  instructions?: ExerciseInstruction[] | null,
): string | null {
  return instructions?.[0]?.instructionText ?? null;
}

/**
 * The hint for an exercise, from the same primary instruction entry. Shown when
 * a first attempt misses, so the learner has something to work with on the next
 * try that is not the answer itself.
 */
export function primaryHintText(
  instructions?: ExerciseInstruction[] | null,
): string | null {
  return instructions?.[0]?.hintText ?? null;
}
