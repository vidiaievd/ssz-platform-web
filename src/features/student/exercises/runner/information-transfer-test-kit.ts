import type { StudentProjection } from '@/lib/shared-kernel/information-transfer';
import {
  check,
  sampleContent,
  SAMPLE_ANSWERS,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  type InformationTransferContent,
} from '@/lib/shared-kernel/information-transfer';
import type { InformationTransferSubmitDetails } from '@/features/student/exercises/types/attempts';

/** The blank as the kernel deals it to a student. Tests only. */
export const dealInf = (
  ex: InformationTransferContent = sampleContent('text'),
): StudentProjection => toStudentProjection(toContent(ex), toExpectedAnswers(ex));

/** The details the engine's validator would return, from the same kernel `check`. Tests only. */
export function infDetails(
  ex: InformationTransferContent,
  answers: Record<string, string>,
  attempt = 1,
  options: { locked?: string[]; firstValues?: Record<string, string> } = {},
): InformationTransferSubmitDetails {
  const result = check({
    ex,
    answers,
    attempt,
    ...(options.locked === undefined ? {} : { locked: options.locked }),
    ...(options.firstValues === undefined ? {} : { firstValues: options.firstValues }),
  });
  return {
    totalItems: result.total,
    passedItems: result.correct,
    correctNow: result.correctNow,
    pct: result.pct,
    passed: result.passed,
    passPct: result.passPct,
    missedRequired: result.missedRequired,
    attempt: result.attempt,
    checksLeft: result.checksLeft,
    closed: result.closed,
    revealed: result.revealed,
    locked: result.locked,
    items: result.cells.map((cell) => ({
      itemId: cell.id,
      value: cell.value,
      verdict: cell.verdict,
      correct: cell.ok,
      ...(cell.canonical === undefined ? {} : { canonical: cell.canonical }),
      ...(cell.why === undefined ? {} : { why: cell.why }),
      ...(cell.hint === undefined ? {} : { hint: cell.hint }),
    })),
  };
}

export { SAMPLE_ANSWERS };
