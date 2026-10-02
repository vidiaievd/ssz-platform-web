import type { AtomCoverage, ContainerCoverage } from '../types';

/** Where a signal lands on the Coverage tab. Both cards carry these ids. */
export type HealthAnchor = 'coverage-skills' | 'coverage-atoms';

/** How loud a signal reads: a zero that should not be zero, a warning, or a plain count. */
export type HealthTone = 'bad' | 'warn' | 'neutral';

export type HealthSignalId = 'listening' | 'speaking' | 'produced' | 'neverTested' | 'notRecorded';

export interface HealthSignal {
  id: HealthSignalId;
  value: number;
  tone: HealthTone;
  anchor: HealthAnchor;
}

/**
 * The draft's zeroes, as the strip under the header draws them.
 *
 * Nothing is computed here beyond picking fields out of two answers the services
 * already gave: the report decides what a course trains, and a second opinion
 * assembled in the header would be a second opinion to reconcile. A missing or
 * unavailable answer yields no signals at all rather than a row of zeroes —
 * "not loaded" and "trains no listening" are different claims.
 */
export function computeHealthSignals(
  coverage: ContainerCoverage | undefined,
  atoms: AtomCoverage | undefined,
): HealthSignal[] {
  const draft = coverage?.draft;
  if (!draft?.available) return [];

  const signals: HealthSignal[] = [
    {
      id: 'listening',
      value: draft.coverage.bySkill.listening ?? 0,
      tone: 'bad',
      anchor: 'coverage-skills',
    },
    {
      id: 'speaking',
      value: draft.coverage.bySkill.spoken ?? 0,
      tone: 'bad',
      anchor: 'coverage-skills',
    },
    {
      // Answers the student writes in their own words — the same number the report's
      // third row prints as `Produced`, so the strip and the report cannot disagree
      // (plan 64, decision G). Recall is not counted: typing one form into a gap is
      // retrieval, not production.
      id: 'produced',
      value: draft.coverage.byModality.production ?? 0,
      tone: 'bad',
      anchor: 'coverage-skills',
    },
  ].map((signal) => ({ ...signal, tone: signal.value === 0 ? 'bad' : 'neutral' }) as HealthSignal);

  if (atoms?.available) {
    signals.push({
      id: 'neverTested',
      value: atoms.summary.untested,
      tone: atoms.summary.untested > 0 ? 'warn' : 'neutral',
      anchor: 'coverage-atoms',
    });
  }

  signals.push({
    id: 'notRecorded',
    value: draft.coverage.unclassified,
    tone: 'neutral',
    anchor: 'coverage-skills',
  });

  return signals;
}
