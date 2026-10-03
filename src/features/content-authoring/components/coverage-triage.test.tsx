import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { AtomCoverage, ContainerCoverage } from '../types';

vi.mock('../api/use-container-coverage', () => ({ useContainerCoverage: vi.fn() }));
vi.mock('../api/use-atom-coverage', () => ({ useAtomCoverage: vi.fn() }));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => '/w/my-school/content/course-1',
}));

const { CoverageTriage } = await import('./coverage-triage');
const { useContainerCoverage } = await import('../api/use-container-coverage');
const { useAtomCoverage } = await import('../api/use-atom-coverage');

function renderTriage(skillIssues: unknown[], atomIssues: unknown[]) {
  vi.mocked(useContainerCoverage).mockReturnValue({
    data: { draft: { available: true, issues: skillIssues } } as unknown as ContainerCoverage,
  } as never);
  vi.mocked(useAtomCoverage).mockReturnValue({
    data: { available: true, issues: atomIssues } as unknown as AtomCoverage,
  } as never);
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CoverageTriage containerId="course-1" />
    </NextIntlClientProvider>,
  );
}

const ABSENT = { code: 'COV_SKILL_ABSENT', level: 'warning', skill: 'listening' };
const BANK = { code: 'COV_MOSTLY_BANK', level: 'info', bank: 34, total: 40 };
const NO_PRODUCTION = { code: 'COV_NO_FREE_PRODUCTION', level: 'warning', total: 40 };
const UNTESTED = { code: 'atom_untested', severity: 'warning', count: 26 };

describe('CoverageTriage', () => {
  it('names the finding and explains why it matters', () => {
    renderTriage([ABSENT], []);

    expect(screen.getByText('Nothing here trains Listening.')).toBeInTheDocument();
    expect(
      screen.getByText('A channel nothing trains is a channel your students never practise here.'),
    ).toBeInTheDocument();
  });

  // A finding you have to go and look for yourself is a finding you read and
  // forget, so every button lands in the tree already filtered.
  it('sends the author to the material the finding is about', () => {
    renderTriage([], [UNTESTED]);

    expect(screen.getByRole('link', { name: 'Open exercises' })).toHaveAttribute(
      'href',
      '/w/my-school/content/course-1?view=structure&type=exercises',
    );
  });

  it('shows three findings and keeps the rest one click away', () => {
    renderTriage([ABSENT, NO_PRODUCTION, BANK], [UNTESTED]);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 more' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  // Notes are true and not tasks: they never take a slot from a finding that is.
  it('keeps notes out of the three and out of the button', () => {
    renderTriage([{ code: 'COV_UNCLASSIFIED', level: 'warning', count: 3 }], [UNTESTED]);

    expect(screen.queryByRole('button', { name: /Show/ })).not.toBeInTheDocument();
    expect(
      screen.getByText(/3 exercises use a template this report does not know/),
    ).toBeInTheDocument();
  });

  it('draws nothing when there is nothing to say', () => {
    const { container } = renderTriage([], []);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CoverageTriage — the lesson recipe', () => {
  // The check of plan 64, phase 10, as the author reads it: what is missing, in how many
  // lessons, and which types would close it.
  it('names the rule, the lessons that miss it, and the types that close it', () => {
    const produces = { axis: 'output', values: ['none'], negate: true, min: 1 };
    vi.mocked(useContainerCoverage).mockReturnValue({
      data: {
        draft: {
          available: true,
          issues: [],
          modules: [
            {
              containerId: 'm1',
              coverage: { total: 3 },
              issues: [],
              recipeIssues: [
                {
                  code: 'RECIPE_BELOW_MIN',
                  level: 'warning',
                  ruleIndex: 0,
                  rule: produces,
                  count: 0,
                  min: 1,
                  total: 3,
                },
              ],
            },
          ],
        },
      } as unknown as ContainerCoverage,
    } as never);
    vi.mocked(useAtomCoverage).mockReturnValue({ data: undefined } as never);

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CoverageTriage containerId="course-1" />
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByText(
        '1 of 1 lesson falls short of the recipe: at least 1 item — Answer: not Nothing written',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^Closes it: Gap-fill, .*Translate to target, .*and 8 more\.$/),
    ).toBeInTheDocument();
  });
});
