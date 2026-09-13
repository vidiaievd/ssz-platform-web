import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { ContainerCoverage, CourseResult, CoverageTallies } from '../types';

const useContainerCoverage = vi.fn();
const useCourseResult = vi.fn();
vi.mock('../api/use-container-coverage', () => ({
  useContainerCoverage: (...args: unknown[]) => useContainerCoverage(...args),
}));
vi.mock('../api/use-course-result', () => ({
  useCourseResult: (...args: unknown[]) => useCourseResult(...args),
}));

const { CoverageResultGrid } = await import('./coverage-result-grid');

const zeroes = () => ({ vocabulary: 0, grammar: 0, orthography: 0, pragmatics: 0, unknown: 0 });

function tallies(overrides: Partial<CoverageTallies> = {}): CoverageTallies {
  return {
    total: 12,
    bySkill: { listening: 0, reading: 9, spoken: 0, written: 3 },
    byFocus: { vocabulary: 6, grammar: 3, orthography: 0, pragmatics: 0, unknown: 3 },
    byForm: { bank: 9, free: 3, mixed: 0, unknown: 0 },
    byPair: {
      listening: zeroes(),
      reading: { ...zeroes(), vocabulary: 6, grammar: 3 },
      spoken: zeroes(),
      written: { ...zeroes(), unknown: 3 },
    },
    emptySkills: ['listening', 'spoken'],
    unclassified: 0,
    ...overrides,
  };
}

function coverage(available = true): ContainerCoverage {
  return {
    containerId: 'course-1',
    containerType: 'course',
    title: 'Norsk B1',
    draft: null,
    published: { version: 'published', available, coverage: tallies(), issues: [], modules: [] },
    diverges: false,
    differences: [],
  };
}

function result(overrides: Partial<CourseResult> = {}): CourseResult {
  return {
    containerId: 'course-1',
    minWeightedSample: 8,
    learners: 3,
    groups: 1,
    cells: [
      {
        skill: 'reading',
        focus: 'vocabulary',
        attempts: 40,
        ewma: 71,
        learners: 3,
        weightedSample: 9.3,
      },
    ],
    ...overrides,
  };
}

function renderGrid(state: {
  coverage?: ContainerCoverage;
  result?: CourseResult;
  resultError?: boolean;
  loading?: boolean;
}) {
  useContainerCoverage.mockReturnValue({
    data: state.coverage,
    isLoading: state.loading ?? false,
    isError: false,
  });
  useCourseResult.mockReturnValue({
    data: state.result,
    isLoading: state.loading ?? false,
    isError: state.resultError ?? false,
  });

  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CoverageResultGrid containerId="course-1" />
    </NextIntlClientProvider>,
  );
}

describe('CoverageResultGrid', () => {
  beforeEach(() => {
    useContainerCoverage.mockReset();
    useCourseResult.mockReset();
  });

  it('tells a pair nobody reached apart from a pair the course never teaches', () => {
    renderGrid({ coverage: coverage(), result: result() });

    // Reading × grammar has three exercises and no attempt: a question for the timetable.
    expect(
      screen.getByLabelText('Reading × Grammar: 3 items, nobody has attempted them'),
    ).toBeInTheDocument();
    // Listening × grammar has nothing behind it at all: a question for the author.
    expect(
      screen.getByLabelText('Listening × Grammar: the course has no exercise for this pair'),
    ).toBeInTheDocument();
  });

  it('counts the two holes separately in the summary', () => {
    renderGrid({ coverage: coverage(), result: result() });

    // Twenty cells: one measured (reading × vocabulary), two covered and unreached
    // (reading × grammar, written × unknown), seventeen with no material behind them.
    // The label appears twice — once as a figure, once in the legend beside the grid.
    expect(screen.getAllByText('Covered, unreached')).toHaveLength(2);
    expect(screen.getByText('2 pairs covered but unreached')).toBeInTheDocument();
    expect(screen.getByText('17 pairs not taught at all')).toBeInTheDocument();
  });

  it('reads the item count from coverage, never from analytics', () => {
    renderGrid({ coverage: coverage(), result: result() });

    expect(
      screen.getByLabelText('Reading × Vocabulary: 71% across 3 learners, over 6 items'),
    ).toBeInTheDocument();
  });

  it('names nobody, and says so where a cell rests on one person', () => {
    renderGrid({
      coverage: coverage(),
      result: result({
        learners: 1,
        cells: [
          {
            skill: 'reading',
            focus: 'vocabulary',
            attempts: 12,
            ewma: 64,
            learners: 1,
            weightedSample: 9,
          },
        ],
      }),
    });

    expect(screen.getByText(/rests on a single learner/)).toBeInTheDocument();
    expect(screen.getByText(/No learner is named here/)).toBeInTheDocument();
  });

  it('declines to judge a cell under the evidence threshold instead of colouring it', () => {
    renderGrid({
      coverage: coverage(),
      result: result({
        cells: [
          {
            skill: 'reading',
            focus: 'vocabulary',
            attempts: 2,
            ewma: 50,
            learners: 1,
            weightedSample: 1.5,
          },
        ],
      }),
    });

    expect(
      screen.getByLabelText(
        'Reading × Vocabulary: attempted, but too little evidence to judge (6 items)',
      ),
    ).toBeInTheDocument();
  });

  it('says the results are missing rather than drawing a course nobody took', () => {
    renderGrid({ coverage: coverage(), resultError: true });

    expect(screen.getByText(/could not reach the analytics service/)).toBeInTheDocument();
    expect(screen.queryByText('Covered, unreached')).not.toBeInTheDocument();
  });

  it('says an unpublished course has nothing to have been taken', () => {
    renderGrid({ coverage: coverage(false), result: result() });

    expect(screen.getByText(/Nothing is published yet/)).toBeInTheDocument();
  });
});
