import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container } from '@/features/content/types';

vi.mock('./container-form', () => ({
  ContainerForm: () => <div data-testid="container-form" />,
}));
vi.mock('./danger-zone', () => ({ DangerZone: () => <div data-testid="danger-zone" /> }));
vi.mock('./preflight-panel', () => ({
  PreflightPanel: () => <div data-testid="preflight-panel" />,
}));
vi.mock('./publish-dialog', () => ({ PublishDialog: () => <div data-testid="publish-dialog" /> }));
vi.mock('./sharing-panel', () => ({ SharingPanel: () => <div data-testid="sharing-panel" /> }));
vi.mock('./tag-input', () => ({ TagInput: () => <div data-testid="tag-input" /> }));
vi.mock('./discard-draft-dialog', () => ({ DiscardDraftDialog: () => null }));
// The publish block is rendered for real — it is what decides whether a
// published course can be published again — but its tree query is stubbed.
vi.mock('../api/use-curriculum-tree', () => ({ useCurriculumTree: vi.fn() }));

const { CourseSettingsDrawer } = await import('./course-settings-drawer');
const { useCurriculumTree } = await import('../api/use-curriculum-tree');

function mockPublishState(publishState: 'draft' | 'published' | 'pending_changes' | null) {
  vi.mocked(useCurriculumTree).mockReturnValue({
    data: publishState ? { publishState } : undefined,
  } as never);
}

beforeEach(() => {
  mockPublishState(null);
});

const BASE_CONTAINER: Container = {
  id: 'course-1',
  slug: 'norwegian-a2',
  title: 'Norwegian A2',
  containerType: 'course',
  targetLanguage: 'no',
  difficultyLevel: 'A2',
  visibility: 'public',
  accessTier: 'free_within_school',

  currentPublishedVersionId: null,
  ownerUserId: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const DRAFT_CONTAINER: Container = { ...BASE_CONTAINER, currentPublishedVersionId: null };
const PUBLISHED_CONTAINER: Container = {
  ...BASE_CONTAINER,
  currentPublishedVersionId: 'version-1',
};

function renderDrawer(
  container: Container,
  extra: Partial<Parameters<typeof CourseSettingsDrawer>[0]> = {},
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CourseSettingsDrawer
          container={container}
          draftVersionId="version-draft"
          open
          onOpenChange={vi.fn()}
          {...extra}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('CourseSettingsDrawer', () => {
  it('renders nothing when closed', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <CourseSettingsDrawer
            container={DRAFT_CONTAINER}
            draftVersionId="version-draft"
            open={false}
            onOpenChange={vi.fn()}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    expect(screen.queryByText('Course settings')).not.toBeInTheDocument();
  });

  it('shows the overview form and pre-flight diagnostics for a draft course', () => {
    mockPublishState('draft');
    renderDrawer(DRAFT_CONTAINER);
    expect(screen.getByText('Course settings')).toBeInTheDocument();
    expect(screen.getByTestId('container-form')).toBeInTheDocument();
    expect(screen.getByTestId('preflight-panel')).toBeInTheDocument();
    expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
    // Releasing lives in one place — the course header, not here.
    expect(screen.queryByTestId('publish-dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/Review & publish/)).toBeInTheDocument();
  });

  it('hides preflight and publish for a course that is published and up to date', () => {
    mockPublishState('published');
    renderDrawer(PUBLISHED_CONTAINER);
    expect(screen.queryByTestId('preflight-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('publish-dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Everything in this course is published.')).toBeInTheDocument();
    expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
  });

  it('diagnoses a published course whose draft is ahead, and offers to discard it', () => {
    mockPublishState('pending_changes');
    renderDrawer(PUBLISHED_CONTAINER);
    expect(screen.getByText('Unpublished changes')).toBeInTheDocument();
    expect(screen.getByTestId('preflight-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard draft' })).toBeInTheDocument();
    expect(screen.queryByTestId('publish-dialog')).not.toBeInTheDocument();
  });

  it('falls back to the container pointer before the tree resolves', () => {
    mockPublishState(null);
    renderDrawer(PUBLISHED_CONTAINER);
    // "published with pending changes" is unknowable without the tree, so the
    // block must not claim anything is pending.
    expect(screen.getByText('Everything in this course is published.')).toBeInTheDocument();
    expect(screen.queryByTestId('preflight-panel')).not.toBeInTheDocument();
  });

  it('hides the danger zone for a teacher role', () => {
    mockPublishState('draft');
    renderDrawer(DRAFT_CONTAINER, { schoolRole: 'teacher' });
    expect(screen.queryByTestId('danger-zone')).not.toBeInTheDocument();
  });

  it('switches to the Tags and Sharing tabs', () => {
    renderDrawer(DRAFT_CONTAINER);
    expect(screen.queryByTestId('tag-input')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Tags' }));
    expect(screen.getByTestId('tag-input')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Sharing' }));
    expect(screen.getByTestId('sharing-panel')).toBeInTheDocument();
  });
});
