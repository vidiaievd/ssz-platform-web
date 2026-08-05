import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import type { Container, PaginatedResponse } from '@/features/content/types';
import { DiscoverCatalog } from './discover-catalog';

vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const setFilters = vi.fn();
let currentFilters: Record<string, unknown> = {};
vi.mock('@/lib/url-filters/use-url-filters', () => ({
  useUrlFilters: () => [currentFilters, setFilters],
}));

function makeContainer(overrides: Partial<Container> & { id: string; title: string }): Container {
  return {
    slug: overrides.id,
    containerType: 'course',
    targetLanguage: 'no',
    difficultyLevel: 'A1',
    visibility: 'public',
    accessTier: 'public_free',
    currentPublishedVersionId: 'v1',
    ownerUserId: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const mockContainers: Container[] = [
  makeContainer({ id: 'c1', title: 'Free course', accessTier: 'public_free' }),
  makeContainer({ id: 'c2', title: 'Paid course', accessTier: 'public_paid' }),
  makeContainer({
    id: 'c3',
    title: 'School course',
    accessTier: 'free_within_school',
    ownerName: 'Oslo School',
  }),
];

const mockResponse: PaginatedResponse<Container> = {
  items: mockContainers,
  pageInfo: { hasNextPage: false },
};

describe('DiscoverCatalog', () => {
  beforeEach(() => {
    currentFilters = {};
    setFilters.mockClear();
  });

  it('shows tab counts derived from the full catalogue and renders every course on "All"', async () => {
    server.use(http.get('/api/content/containers', () => HttpResponse.json(mockResponse)));

    renderWithProviders(<DiscoverCatalog />);

    expect(await screen.findByText('Free course')).toBeInTheDocument();
    expect(screen.getByText('Paid course')).toBeInTheDocument();
    expect(screen.getByText('School course')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: /All courses/ })).toHaveTextContent('3');
    expect(screen.getByRole('tab', { name: /^Free/ })).toHaveTextContent('1');
    expect(screen.getByRole('tab', { name: /By subscription/ })).toHaveTextContent('1');
    expect(screen.getByRole('tab', { name: /From my schools/ })).toHaveTextContent('1');
  });

  it('filters the grid to match the active tab, keeping the tab counts unchanged', async () => {
    currentFilters = { tab: 'paid' };
    server.use(http.get('/api/content/containers', () => HttpResponse.json(mockResponse)));

    renderWithProviders(<DiscoverCatalog />);

    expect(await screen.findByText('Paid course')).toBeInTheDocument();
    expect(screen.queryByText('Free course')).not.toBeInTheDocument();
    expect(screen.queryByText('School course')).not.toBeInTheDocument();

    const paidTab = screen.getByRole('tab', { name: /By subscription/ });
    expect(paidTab).toHaveAttribute('aria-selected', 'true');
    // one course matches the grid, but the full catalogue still has 3
    expect(screen.getByRole('tab', { name: /All courses/ })).toHaveTextContent('3');
  });

  it('clears search/language/level filters but leaves the active tab untouched', async () => {
    currentFilters = { tab: 'paid', q: 'no-such-course' };
    server.use(http.get('/api/content/containers', () => HttpResponse.json(mockResponse)));

    renderWithProviders(<DiscoverCatalog />);

    const clearButton = await screen.findByRole('button', { name: /Clear filters/i });
    await userEvent.click(clearButton);

    expect(setFilters).toHaveBeenCalledWith({ q: undefined, lang: undefined, levels: undefined });
  });
});
