import { describe, expect, it } from 'vitest';

import type { AtomCoverage, ContainerCoverage, CoverageReport } from '../types';

import { computeHealthSignals } from './health-signals';

function draftReport(over: Partial<CoverageReport['coverage']> = {}): CoverageReport {
  return {
    version: 'draft',
    available: true,
    coverage: {
      total: 40,
      bySkill: { listening: 0, reading: 31, spoken: 0, written: 9 },
      byFocus: { vocabulary: 20, grammar: 20, orthography: 0, pronunciation: 0, pragmatics: 0, unknown: 0 },
      byForm: { bank: 34, free: 0, mixed: 6, unknown: 0 },
      byModality: { recognition: 34, recall: 6, production: 0, unknown: 0 },
      byPair: {} as CoverageReport['coverage']['byPair'],
      emptySkills: ['listening', 'spoken'],
      unclassified: 37,
      ...over,
    },
    issues: [],
    modules: [],
  };
}

function coverage(draft: CoverageReport | null): ContainerCoverage {
  return {
    containerId: 'course-1',
    containerType: 'course',
    title: 'Norwegian A2',
    draft,
    published: null,
    diverges: false,
    differences: [],
  };
}

function atoms(untested: number, available = true): AtomCoverage {
  return {
    containerId: 'course-1',
    containerType: 'course',
    title: 'Norwegian A2',
    version: 'draft',
    available,
    summary: {
      introduced: 120,
      introducedByTrack: {},
      tested: 94,
      untested,
      contextOnly: 0,
      singleModality: 0,
      practisedElsewhere: 0,
      byModality: { recognition: 0, recall: 0, production: 0, unknown: 0 },
      exercises: 40,
      exercisesAddressed: 40,
    },
    issues: [],
    atoms: [],
    rulesWithoutAtoms: [],
    units: [],
  };
}

describe('computeHealthSignals', () => {
  it('reads the draft zeroes straight off the two reports', () => {
    const signals = computeHealthSignals(coverage(draftReport()), atoms(26));

    expect(signals.map((s) => [s.id, s.value, s.tone])).toEqual([
      ['listening', 0, 'bad'],
      ['speaking', 0, 'bad'],
      ['produced', 0, 'bad'],
      ['neverTested', 26, 'warn'],
      ['notRecorded', 37, 'neutral'],
    ]);
  });

  it('stops calling a channel bad once something trains it', () => {
    const signals = computeHealthSignals(
      coverage(draftReport({ bySkill: { listening: 4, reading: 31, spoken: 0, written: 9 } })),
      atoms(0),
    );

    expect(signals.find((s) => s.id === 'listening')).toMatchObject({ value: 4, tone: 'neutral' });
    expect(signals.find((s) => s.id === 'speaking')).toMatchObject({ value: 0, tone: 'bad' });
    // Nothing left untested is not a warning, it is the good case.
    expect(signals.find((s) => s.id === 'neverTested')).toMatchObject({
      value: 0,
      tone: 'neutral',
    });
  });

  // The same number as the report's `Produced`: typing one form into a gap is
  // recall, and a typed answer is not by itself a produced one (plan 64, decision G).
  it('counts only answers the student must produce', () => {
    const signals = computeHealthSignals(
      coverage(
        draftReport({
          byForm: { bank: 30, free: 10, mixed: 0, unknown: 0 },
          byModality: { recognition: 30, recall: 7, production: 3, unknown: 0 },
        }),
      ),
      atoms(2),
    );

    expect(signals.find((s) => s.id === 'produced')).toMatchObject({ value: 3, tone: 'neutral' });
  });

  it('says nothing at all until the report is in', () => {
    expect(computeHealthSignals(undefined, undefined)).toEqual([]);
    expect(computeHealthSignals(coverage(null), atoms(26))).toEqual([]);
  });

  // A course whose facts have not been counted still has channels worth showing;
  // the one signal that has no answer is the one left out.
  it('drops the fact signal when the fact report has no such version', () => {
    const signals = computeHealthSignals(coverage(draftReport()), atoms(26, false));

    expect(signals.map((s) => s.id)).toEqual(['listening', 'speaking', 'produced', 'notRecorded']);
  });

  it('points each signal at the card that explains it', () => {
    const signals = computeHealthSignals(coverage(draftReport()), atoms(26));

    expect(signals.find((s) => s.id === 'neverTested')?.anchor).toBe('coverage-atoms');
    expect(signals.find((s) => s.id === 'listening')?.anchor).toBe('coverage-skills');
  });
});
