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
