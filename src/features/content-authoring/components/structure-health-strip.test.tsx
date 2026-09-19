import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { AtomCoverage, ContainerCoverage } from '../types';

vi.mock('../api/use-container-coverage', () => ({ useContainerCoverage: vi.fn() }));
vi.mock('../api/use-atom-coverage', () => ({ useAtomCoverage: vi.fn() }));

const { StructureHealthStrip } = await import('./structure-health-strip');
const { useContainerCoverage } = await import('../api/use-container-coverage');
const { useAtomCoverage } = await import('../api/use-atom-coverage');

const COVERAGE = {
  containerId: 'course-1',
  containerType: 'course',
  title: 'Norwegian A2',
  draft: {
    version: 'draft',
    available: true,
    coverage: {
      total: 40,
      bySkill: { listening: 0, reading: 31, spoken: 0, written: 9 },
      byFocus: { vocabulary: 20, grammar: 20, orthography: 0, pragmatics: 0, unknown: 0 },
      byForm: { bank: 34, free: 0, mixed: 6, unknown: 0 },
      byPair: {},
      emptySkills: ['listening', 'spoken'],
      unclassified: 37,
    },
    issues: [],
    modules: [],
  },
  published: null,
  diverges: false,
  differences: [],
} as unknown as ContainerCoverage;

const ATOMS = {
  available: true,
  summary: { untested: 26 },
} as unknown as AtomCoverage;

function renderStrip(onOpenCoverage = vi.fn(), coverage: ContainerCoverage | undefined = COVERAGE) {
  vi.mocked(useContainerCoverage).mockReturnValue({ data: coverage } as never);
  vi.mocked(useAtomCoverage).mockReturnValue({ data: ATOMS } as never);
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StructureHealthStrip containerId="course-1" onOpenCoverage={onOpenCoverage} />
    </NextIntlClientProvider>,
  );
  return onOpenCoverage;
}

describe('StructureHealthStrip', () => {
  // The whole point of the band: a course that trains no listening says so
  // without anyone opening the report.
  it('shows the draft zeroes without the report being open', () => {
    renderStrip();
    expect(screen.getByRole('button', { name: /Listening 0/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Speaking 0/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Produced answers 0/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Never tested 26/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Not recorded 37/ })).toBeInTheDocument();
  });

  it('sends each signal to the card that explains it', () => {
    const onOpenCoverage = renderStrip();

    fireEvent.click(screen.getByRole('button', { name: /Listening 0/ }));
    expect(onOpenCoverage).toHaveBeenCalledWith('coverage-skills');

    fireEvent.click(screen.getByRole('button', { name: /Never tested 26/ }));
    expect(onOpenCoverage).toHaveBeenCalledWith('coverage-atoms');

    fireEvent.click(screen.getByRole('button', { name: /Open coverage report/ }));
    expect(onOpenCoverage).toHaveBeenCalledTimes(3);
  });

  // A strip of zeroes while the answer is still in flight would accuse the
  // author of something the data has not said.
  it('draws nothing until the report is in', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <StripWithNoData />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

function StripWithNoData() {
  vi.mocked(useContainerCoverage).mockReturnValue({ data: undefined } as never);
  vi.mocked(useAtomCoverage).mockReturnValue({ data: undefined } as never);
  return <StructureHealthStrip containerId="course-1" onOpenCoverage={vi.fn()} />;
}
