import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { AtomCoverage, AtomCoverageIssue, AtomCoverageSummary } from '../types';

const useAtomCoverage = vi.fn();
vi.mock('../api/use-atom-coverage', () => ({
  useAtomCoverage: (...args: unknown[]) => useAtomCoverage(...args),
}));

const { AtomCoverageReport } = await import('./atom-coverage-report');

function summary(overrides: Partial<AtomCoverageSummary> = {}): AtomCoverageSummary {
  return {
    introduced: 30,
    introducedByTrack: { lexis: 26, grammar: 4 },
    tested: 19,
    untested: 11,
    contextOnly: 0,
    singleModality: 8,
    practisedElsewhere: 0,
    byModality: { recognition: 29, recall: 12, production: 12, unknown: 0 },
    exercises: 11,
    exercisesAddressed: 10,
    ...overrides,
  };
}

function coverage(overrides: Partial<AtomCoverage> = {}): AtomCoverage {
  return {
    containerId: 'unit-1',
    containerType: 'module',
    title: '1A — Bartek søker ny jobb',
    version: 'draft',
    available: true,
    summary: summary(),
    issues: [],
    atoms: [],
    rulesWithoutAtoms: [],
    units: [],
    ...overrides,
  };
}

function renderReport(state: { data?: AtomCoverage; isLoading?: boolean; isError?: boolean }) {
  useAtomCoverage.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
  });

  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <AtomCoverageReport containerId="unit-1" />
    </NextIntlClientProvider>,
  );
}

describe('AtomCoverageReport', () => {
  beforeEach(() => {
    useAtomCoverage.mockReset();
  });

  it('prints how many facts are taught and how many are never tested', () => {
    renderReport({ data: coverage() });

    expect(screen.getByText('Introduced')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('Never tested')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  /**
   * The line the whole report is read against. Six untested words means one thing when
   * every exercise is addressed and nothing whatever when ten of forty are.
   */
  it('says how much of the catalogue is addressed at all', () => {
    renderReport({ data: coverage() });

    expect(screen.getByText(/10 of 11 exercises say what they are about/)).toBeInTheDocument();
  });

  it('says so plainly when every exercise is addressed', () => {
    renderReport({
      data: coverage({ summary: summary({ exercises: 11, exercisesAddressed: 11 }) }),
    });

    expect(screen.getByText(/All 11 exercises say what they are about/)).toBeInTheDocument();
  });

  /**
   * A zero in the modality row is the report's main product, and it is only a finding if
   * it is printed — an omitted key looks exactly like a key nobody thought about.
   */
  it('prints a modality nothing trains, and names the silence', () => {
    renderReport({
      data: coverage({
        summary: summary({ byModality: { recognition: 29, recall: 3, production: 0, unknown: 0 } }),
      }),
    });

    expect(screen.getByText('Produced')).toBeInTheDocument();
    expect(
      screen.getByText('Not one item here asks the learner to produce language.'),
    ).toBeInTheDocument();
  });

  it('groups the untested facts into one finding and names them', () => {
    const issues: AtomCoverageIssue[] = [
      { code: 'atom_untested', severity: 'warning', title: 'ansatt' },
      { code: 'atom_untested', severity: 'warning', title: 'ansvar' },
    ];
    renderReport({ data: coverage({ issues }) });

    expect(screen.getByText('2 facts this teaches and never tests')).toBeInTheDocument();
    expect(screen.getByText(/ansatt, ansvar/)).toBeInTheDocument();
  });

  /** "Only ever recognised" and "only ever produced" are different remarks. */
  it('keeps the two single-modality findings apart', () => {
    const issues: AtomCoverageIssue[] = [
      { code: 'atom_single_modality', severity: 'warning', modality: 'recognition', title: 'CV' },
      {
        code: 'atom_single_modality',
        severity: 'note',
        modality: 'production',
        title: 'videreutvikling',
      },
    ];
    renderReport({ data: coverage({ issues }) });

    expect(screen.getByText('1 fact is only ever picked from a list')).toBeInTheDocument();
    expect(screen.getByText('1 fact is only ever produced')).toBeInTheDocument();
  });

  it('folds a long list of names and unfolds it on demand', async () => {
    const issues: AtomCoverageIssue[] = Array.from({ length: 11 }, (_, index) => ({
      code: 'atom_untested' as const,
      severity: 'warning' as const,
      title: `word-${index}`,
    }));
    renderReport({ data: coverage({ issues }) });

    expect(screen.queryByText(/word-10/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '+3 more' }));
    expect(screen.getByText(/word-10/)).toBeInTheDocument();
  });

  /** Named once. The service sends them as findings and as a list, and both were drawn. */
  it('names the rules nobody has cut into atoms, exactly once', () => {
    renderReport({
      data: coverage({
        issues: [
          { code: 'rule_without_atoms', severity: 'note', ruleId: 'r1', title: 'Indirekte tale' },
          { code: 'rule_without_atoms', severity: 'note', ruleId: 'r2', title: 'Modale verb' },
        ],
        rulesWithoutAtoms: [
          { ruleId: 'r1', title: 'Indirekte tale' },
          { ruleId: 'r2', title: 'Modale verb' },
        ],
      }),
    });

    expect(screen.getAllByText('2 rules have not been cut into atoms')).toHaveLength(1);
    expect(screen.getByText(/Indirekte tale, Modale verb/)).toBeInTheDocument();
  });

  it('shows the per-unit table only when asked', async () => {
    renderReport({
      data: coverage({
        units: [
          { containerId: 'u1', title: '1A', summary: summary() },
          {
            containerId: 'u2',
            title: '1B',
            summary: summary({ tested: 0, untested: 21, exercisesAddressed: 0, exercises: 6 }),
          },
        ].map((unit) => ({ ...unit, issues: [] })),
      }),
    });

    expect(screen.queryByText('1B')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /2 units, one by one/ }));
    expect(screen.getByText('1B')).toBeInTheDocument();
    expect(screen.getByText('0/6')).toBeInTheDocument();
  });

  /** A version that does not exist is not a container that teaches nothing. */
  it('says a missing version is missing, rather than drawing zeroes', () => {
    renderReport({ data: coverage({ available: false }) });

    expect(screen.getByText('This version does not exist yet.')).toBeInTheDocument();
    expect(screen.queryByText('Introduced')).not.toBeInTheDocument();
  });

  it('says nothing is introduced yet rather than reporting a course that tests nothing', () => {
    renderReport({
      data: coverage({ summary: summary({ introduced: 0, tested: 0, untested: 0 }) }),
    });

    expect(screen.getByText(/Nothing here introduces a word or a rule yet/)).toBeInTheDocument();
  });

  it('reports a failure as a failure, not as an empty report', () => {
    renderReport({ isError: true });

    expect(screen.getByText('Could not work out what this teaches.')).toBeInTheDocument();
  });
});
