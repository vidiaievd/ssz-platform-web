import type { MasteryVerdict } from '../types';

/**
 * Where "this is going well" starts.
 *
 * 0.8, taken from `CAN_DO_MASTERY_THRESHOLD` in learning-service, which took it from
 * `GRAMMAR_RULE_MASTERY_THRESHOLD` (plan 21 §2.2). The number is reused rather than
 * chosen: a learner who is "achieved" on a can-do descriptor and "still weak" on the
 * profile in the same afternoon is the platform contradicting itself, and there is no
 * evidence yet that would justify a second bar (Q2 is still open).
 *
 * It is a *display* bar, not a rule of the profile — the kernel deliberately returns
 * one ordered list, because sorting by weakness is the judgement and cutting it into
 * blocks is presentation (plan 53: the rule lives in the kernel, the UI filters its
 * output).
 */
export const STRONG_AT = 0.8;

export interface SplitVerdicts {
  /** Strongest first — this half is read as "what is working". */
  strong: MasteryVerdict[];
  /** Weakest first, as the kernel ordered them. */
  weak: MasteryVerdict[];
}

/**
 * Cut the kernel's one ordered list into the two blocks §6.1 asks for.
 *
 * The order inside each block is the one that makes the block readable: the weak list
 * keeps the kernel's weakest-first order, and the strong list is reversed so that the
 * best cell leads it. Neither block is truncated here — how many a surface has room
 * for is the surface's business.
 */
export function splitVerdicts(
  verdicts: readonly MasteryVerdict[],
  strongAt: number = STRONG_AT,
): SplitVerdicts {
  const strong: MasteryVerdict[] = [];
  const weak: MasteryVerdict[] = [];

  for (const verdict of verdicts) {
    (verdict.successRateEwma >= strongAt ? strong : weak).push(verdict);
  }

  strong.sort((a, b) => b.successRateEwma - a.successRateEwma);
  return { strong, weak };
}
