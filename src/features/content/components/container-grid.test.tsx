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
    containerType: 'course',
    targetLanguage: 'no',
    difficultyLevel: 'A1',
    visibility: 'public',
    accessTier: 'public_free',
    currentPublishedVersionId: 'v1',
    ownerUserId: 'u1',
    lessonCount: 10,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    slug: 'english-basics',
    title: 'English Basics',
    containerType: 'module',
    targetLanguage: 'en',
    difficultyLevel: 'A1',
    visibility: 'school_private',
    accessTier: 'free_within_school',
    currentPublishedVersionId: 'v2',
    ownerUserId: 'u1',
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
