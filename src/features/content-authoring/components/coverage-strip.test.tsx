import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { ContainerCoverage, CoverageIssue, CoverageTallies } from '../types';

const useContainerCoverage = vi.fn();
vi.mock('../api/use-container-coverage', () => ({
  useContainerCoverage: (...args: unknown[]) => useContainerCoverage(...args),
}));

const { CoverageStrip } = await import('./coverage-strip');

function tallies(overrides: Partial<CoverageTallies> = {}): CoverageTallies {
  return {
    total: 10,
    bySkill: { listening: 0, reading: 8, spoken: 0, written: 2 },
    byFocus: { vocabulary: 6, grammar: 3, orthography: 0, pragmatics: 0, unknown: 1 },
    byForm: { bank: 7, free: 3, mixed: 0, unknown: 0 },
    emptySkills: ['listening', 'spoken'],
    unclassified: 0,
    ...overrides,
  };
}

function report(coverage = tallies(), issues: CoverageIssue[] = []) {
  return { version: 'draft' as const, available: true, coverage, issues, modules: [] };
}

function coverage(overrides: Partial<ContainerCoverage> = {}): ContainerCoverage {
  return {
    containerId: 'course-1',
    containerType: 'course',
    title: 'Norsk B1',
    draft: report(),
    published: null,
    diverges: false,
    differences: [],
    ...overrides,
  };
}

function renderStrip(state: { data?: ContainerCoverage; isLoading?: boolean; isError?: boolean }) {
  useContainerCoverage.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
  });

  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CoverageStrip containerId="course-1" />
    </NextIntlClientProvider>,
  );
}

/** The cell for one axis value, found by its label and read together with its count. */
function cell(label: string): string {
  const node = screen.getByText(label).closest('div');
  return node?.textContent ?? '';
}

describe('CoverageStrip', () => {
  beforeEach(() => useContainerCoverage.mockReset());

  it('shows a channel nothing trains as a zero, without anything being opened', () => {
    renderStrip({ data: coverage() });

    expect(cell('Listening')).toContain('0');
    expect(cell('Reading')).toContain('8');
    expect(screen.getByText(/Nothing here trains: Listening, Speaking/)).toBeInTheDocument();
  });

  it('counts recognition against production, which the skill row cannot show', () => {
    renderStrip({ data: coverage() });

    expect(cell('From a list')).toContain('7');
    expect(cell('Typed')).toContain('3');
  });

  it('renders a remark from its code and numbers, not from prose the service sent', () => {
    renderStrip({
      data: coverage({
        draft: report(tallies(), [
          { code: 'COV_MOSTLY_BANK', level: 'info', bank: 9, total: 10 },
          { code: 'COV_SKILL_ABSENT', level: 'warning', skill: 'listening' },
        ]),
      }),
    });

    expect(
      screen.getByText('9 of 10 exercises are answered by choosing, not by producing.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Nothing here trains Listening.')).toBeInTheDocument();
  });

  it('drops a remark it has no wording for rather than crashing on it', () => {
    renderStrip({
      data: coverage({
        draft: report(tallies(), [
          { code: 'COV_FROM_A_LATER_RELEASE', level: 'warning' } as unknown as CoverageIssue,
        ]),
      }),
    });

    expect(screen.getByText('Reading')).toBeInTheDocument();
  });

  it('says nothing about the published version while the two agree', () => {
    renderStrip({ data: coverage({ published: report(), diverges: false }) });

    expect(screen.queryByText(/The published version differs/)).not.toBeInTheDocument();
  });

  it('names the diverging cells and unfolds the published strip on demand', async () => {
    renderStrip({
      data: coverage({
        published: {
          ...report(tallies({ bySkill: { listening: 6, reading: 8, spoken: 0, written: 2 } })),
          version: 'published',
        },
        diverges: true,
        differences: [{ axis: 'skill', key: 'listening', draft: 0, published: 6 }],
      }),
    });

    const toggle = screen.getByRole('button', { name: /The published version differs/ });
    expect(toggle).toHaveTextContent('Listening 0 against 6');
    expect(screen.queryByText('What students have now')).not.toBeInTheDocument();

    await userEvent.click(toggle);

    const published = screen.getByText('What students have now').closest('div');
    expect(within(published as HTMLElement).getByText('Listening')).toBeInTheDocument();
  });

  it('says the container is empty rather than drawing a strip of zeroes', () => {
    renderStrip({
      data: coverage({
        draft: report(
          tallies({
            total: 0,
            bySkill: { listening: 0, reading: 0, spoken: 0, written: 0 },
            byFocus: { vocabulary: 0, grammar: 0, orthography: 0, pragmatics: 0, unknown: 0 },
            byForm: { bank: 0, free: 0, mixed: 0, unknown: 0 },
          }),
        ),
      }),
    });

    expect(screen.getByText(/nothing to count/)).toBeInTheDocument();
    expect(screen.queryByText('Listening')).not.toBeInTheDocument();
  });

  it('reports a failed count instead of an empty one', () => {
    renderStrip({ isError: true });

    expect(screen.getByText('Could not work out what this trains.')).toBeInTheDocument();
  });
});
