import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

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

const { CourseSettingsDrawer } = await import('./course-settings-drawer');

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

function renderDrawer(container: Container, extra: Partial<Parameters<typeof CourseSettingsDrawer>[0]> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CourseSettingsDrawer container={container} open onOpenChange={vi.fn()} {...extra} />
    </NextIntlClientProvider>,
  );
}

describe('CourseSettingsDrawer', () => {
  it('renders nothing when closed', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CourseSettingsDrawer container={DRAFT_CONTAINER} open={false} onOpenChange={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText('Course settings')).not.toBeInTheDocument();
  });

  it('shows the overview form, preflight panel and publish dialog for a draft course', () => {
    renderDrawer(DRAFT_CONTAINER);
    expect(screen.getByText('Course settings')).toBeInTheDocument();
    expect(screen.getByTestId('container-form')).toBeInTheDocument();
    expect(screen.getByTestId('preflight-panel')).toBeInTheDocument();
    expect(screen.getByTestId('publish-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
  });

  it('hides preflight and publish for a published course', () => {
    renderDrawer(PUBLISHED_CONTAINER);
    expect(screen.queryByTestId('preflight-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('publish-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
  });

  it('hides the danger zone for a teacher role', () => {
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
