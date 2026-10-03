import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { AtomCoverage, ContainerCoverage } from '../types';

vi.mock('../api/use-container-coverage', () => ({ useContainerCoverage: vi.fn() }));
vi.mock('../api/use-atom-coverage', () => ({ useAtomCoverage: vi.fn() }));
vi.mock('./coverage-triage', () => ({
  CoverageTriage: () => <div data-testid="triage" />,
}));
vi.mock('./coverage-strip', () => ({
  CoverageStrip: () => <div data-testid="coverage-strip" />,
}));
vi.mock('./atom-coverage-report', () => ({
  AtomCoverageReport: () => <div data-testid="atom-coverage-report" />,
}));
vi.mock('./coverage-result-grid', () => ({
  CoverageResultGrid: () => <div data-testid="coverage-result-grid" />,
}));

const { CoverageView } = await import('./coverage-view');
const { useContainerCoverage } = await import('../api/use-container-coverage');
const { useAtomCoverage } = await import('../api/use-atom-coverage');

function renderView({
  containerType = 'course',
  publishedVersionNumber = 4 as number | null,
} = {}) {
  vi.mocked(useContainerCoverage).mockReturnValue({
    data: { draft: { available: true, coverage: { total: 214 } } } as unknown as ContainerCoverage,
  } as never);
  vi.mocked(useAtomCoverage).mockReturnValue({
    data: { available: true, summary: { introduced: 104 } } as unknown as AtomCoverage,
  } as never);

  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CoverageView
        containerId="course-1"
        containerType={containerType}
        publishedVersionNumber={publishedVersionNumber}
      />
    </NextIntlClientProvider>,
  );
}

describe('CoverageView', () => {
  // Three questions in three units, and the one mistake that makes the report
  // useless is adding two of them together.
  it('says what unit each card counts in', () => {
    renderView();

    expect(screen.getByText('counted in exercises')).toBeInTheDocument();
    expect(screen.getByText('counted in facts')).toBeInTheDocument();
    expect(screen.getByText('counted in results')).toBeInTheDocument();
  });

  it('opens with what to do about the course, not with what it is', () => {
    const { container } = renderView();

    const order = [...container.querySelectorAll('[data-testid]')].map((el) =>
      el.getAttribute('data-testid'),
    );
    expect(order).toEqual([
      'triage',
      'coverage-strip',
      'atom-coverage-report',
      'coverage-result-grid',
    ]);
  });

  it('sizes the draft against the version students have', () => {
    renderView();

    expect(
      screen.getByText('Against v4, which students have now · 214 exercises, 104 facts'),
    ).toBeInTheDocument();
  });

  // A course nobody published has no published coverage, which is a different
  // claim from a course of zeroes.
  it('says so plainly when nothing has ever been published', () => {
    renderView({ publishedVersionNumber: null });

    expect(screen.getByText('Never published · 214 exercises, 104 facts')).toBeInTheDocument();
  });

  // A module's results are the course's results sliced too thin to read.
  it('leaves the result zone off a module', () => {
    renderView({ containerType: 'module' });

    expect(screen.queryByTestId('coverage-result-grid')).not.toBeInTheDocument();
    expect(screen.queryByText('counted in results')).not.toBeInTheDocument();
  });

  // The health strip's signals land on these two.
  it('anchors the two draft cards for the header signals', () => {
    const { container } = renderView();

    expect(container.querySelector('#coverage-skills')).toBeInTheDocument();
    expect(container.querySelector('#coverage-atoms')).toBeInTheDocument();
  });
});
