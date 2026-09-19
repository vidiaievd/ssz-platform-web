import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ContainerCoverage } from '../types';

vi.mock('../api/use-container-coverage', () => ({ useContainerCoverage: vi.fn() }));
vi.mock('./coverage-strip', () => ({
  CoverageStrip: ({ containerId, hideHeading }: { containerId: string; hideHeading?: boolean }) => (
    <div data-testid="strip" data-container={containerId} data-headless={String(!!hideHeading)} />
  ),
}));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => '/w/my-school/content/course-1',
}));

const { ModuleCoverageTab } = await import('./module-coverage-tab');
const { useContainerCoverage } = await import('../api/use-container-coverage');

function renderTab(total: number | null) {
  vi.mocked(useContainerCoverage).mockReturnValue({
    data:
      total === null
        ? undefined
        : ({ draft: { available: true, coverage: { total } } } as unknown as ContainerCoverage),
  } as never);
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ModuleCoverageTab containerId="module-1" />
    </NextIntlClientProvider>,
  );
}

describe('ModuleCoverageTab', () => {
  // The one mistake that makes the whole report useless is adding two counts in
  // different units together, so every count says its unit.
  it('says what it is counting and in what unit', () => {
    renderTab(12);

    expect(screen.getByText('What this module trains')).toBeInTheDocument();
    expect(screen.getByText('Draft · 12 exercises in this module')).toBeInTheDocument();
    expect(screen.getByText('counted in exercises')).toBeInTheDocument();
  });

  it('lets the strip carry the numbers and keeps its heading out of the way', () => {
    renderTab(3);

    const strip = screen.getByTestId('strip');
    expect(strip).toHaveAttribute('data-container', 'module-1');
    expect(strip).toHaveAttribute('data-headless', 'true');
  });

  // The module's numbers cannot say what the course as a whole is missing, and
  // clicking every module to find out is not an answer.
  it('links to the course report rather than repeating it', () => {
    renderTab(3);

    expect(screen.getByRole('link', { name: /Open the full report/ })).toHaveAttribute(
      'href',
      '/w/my-school/content/course-1?view=coverage',
    );
  });

  it('says nothing about a count it has not been given yet', () => {
    renderTab(null);

    expect(screen.getByText('Draft · 0 exercises in this module')).toBeInTheDocument();
  });
});
