import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { PreflightResult } from '../types';

vi.mock('next/navigation', () => ({ useParams: () => ({ schoolSlug: 'my-school' }) }));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const { PreflightPanel } = await import('./preflight-panel');

function result(overrides: Partial<PreflightResult> = {}): PreflightResult {
  return {
    canPublish: false,
    canPublishAnyway: false,
    blockerCount: 0,
    warningCount: 0,
    checks: [],
    ...overrides,
  } as PreflightResult;
}

function renderPanel(preflight: PreflightResult) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PreflightPanel containerId="course-1" result={preflight} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('PreflightPanel', () => {
  it('says a clean course is ready', () => {
    renderPanel(result({ canPublish: true }));

    expect(screen.getByText('All checks passed — ready to publish')).toBeInTheDocument();
  });

  it('counts blockers and warnings, and says publishing is off', () => {
    renderPanel(result({ blockerCount: 1, warningCount: 3 }));

    // Singular and plural come from the message catalogue, not from string
    // concatenation — the panel used to hardcode English "blocker(s)".
    expect(screen.getByText('1 blocker')).toBeInTheDocument();
    expect(screen.getByText('3 warnings')).toBeInTheDocument();
    expect(screen.getByText('cannot publish')).toBeInTheDocument();
  });

  it('lets warnings through', () => {
    renderPanel(result({ warningCount: 2, canPublish: true }));

    expect(screen.getByText('can publish with warnings')).toBeInTheDocument();
    expect(screen.queryByText('cannot publish')).not.toBeInTheDocument();
  });
});
