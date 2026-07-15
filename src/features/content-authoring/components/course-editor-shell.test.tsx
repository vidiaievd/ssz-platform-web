import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container } from '@/features/content/types';

vi.mock('./course-settings-drawer', () => ({
  CourseSettingsDrawer: ({
    open,
    onOpenChange,
    trigger,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trigger: React.ReactNode;
  }) => (
    <div onClick={() => onOpenChange(true)}>
      {trigger}
      {open && <div data-testid="settings-drawer-open" />}
    </div>
  ),
}));
vi.mock('./course-structure-panel', () => ({
  CourseStructurePanel: ({ containerId, versionId }: { containerId: string; versionId: string }) => (
    <div data-testid="course-structure-panel">
      {containerId}/{versionId}
    </div>
  ),
}));

const { CourseEditorShell } = await import('./course-editor-shell');

const CONTAINER: Container = {
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

function renderShell(draftVersionId: string | null) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CourseEditorShell container={CONTAINER} schoolSlug="my-school" draftVersionId={draftVersionId} />
    </NextIntlClientProvider>,
  );
}

describe('CourseEditorShell', () => {
  it('renders the curriculum tree panel as the primary surface', () => {
    renderShell('version-1');
    expect(screen.getByTestId('course-structure-panel')).toHaveTextContent('course-1/version-1');
  });

  it('shows a load error in place of the panel when there is no draft version', () => {
    renderShell(null);
    expect(screen.queryByTestId('course-structure-panel')).not.toBeInTheDocument();
    expect(screen.getByText('Could not load the curriculum tree.')).toBeInTheDocument();
  });

  it('opens the settings drawer from the header button', () => {
    renderShell('version-1');
    expect(screen.queryByTestId('settings-drawer-open')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }));
    expect(screen.getByTestId('settings-drawer-open')).toBeInTheDocument();
  });
});
