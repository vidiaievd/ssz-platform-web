import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import type { Container, PaginatedResponse } from '../types';
import { ContainerGrid } from './container-grid';

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

vi.mock('@/lib/url-filters/use-url-filters', () => ({
  useUrlFilters: () => [{}],
}));

const mockContainers: Container[] = [
  {
    id: 'c1',
    slug: 'norsk-grunnkurs',
    title: 'Norsk grunnkurs',
    type: 'COURSE',
    targetLanguage: 'no',
    accessTier: 'PUBLIC',
    isPublished: true,
    ownerId: 'u1',
    lessonCount: 10,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    slug: 'english-basics',
    title: 'English Basics',
    type: 'MODULE',
    targetLanguage: 'en',
    accessTier: 'FREE_WITHIN_SCHOOL',
    isPublished: true,
    ownerId: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockResponse: PaginatedResponse<Container> = {
  items: mockContainers,
  pageInfo: { hasNextPage: false },
};

describe('ContainerGrid', () => {
  it('renders container cards from API response', async () => {
    server.use(
      http.get('/api/content/containers', () => HttpResponse.json(mockResponse)),
    );

    renderWithProviders(
      <ContainerGrid scope="public" buildHref={(slug) => `/catalogue/${slug}`} />,
    );

    expect(await screen.findByText('Norsk grunnkurs')).toBeInTheDocument();
    expect(await screen.findByText('English Basics')).toBeInTheDocument();
  });

  it('renders empty state when no containers are returned', async () => {
    server.use(
      http.get('/api/content/containers', () =>
        HttpResponse.json({ items: [], pageInfo: { hasNextPage: false } }),
      ),
    );

    renderWithProviders(
      <ContainerGrid scope="public" buildHref={(slug) => `/catalogue/${slug}`} />,
    );

    expect(await screen.findByText('No courses found. Try adjusting the filters.')).toBeInTheDocument();
  });
});
