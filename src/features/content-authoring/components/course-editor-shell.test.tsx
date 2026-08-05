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
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('../api/use-curriculum-tree', () => ({ useCurriculumTree: vi.fn() }));
// The real dialog pulls in the publish server action, which cannot load in a
// client test environment.
vi.mock('./review-publish-dialog', () => ({
  ReviewPublishDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="review-publish-open" /> : null,
}));
vi.mock('./course-structure-panel', () => ({
  CourseStructurePanel: ({
    containerId,
    versionId,
  }: {
    containerId: string;
    versionId: string;
  }) => (
    <div data-testid="course-structure-panel">
      {containerId}/{versionId}
    </div>
  ),
}));

const { CourseEditorShell } = await import('./course-editor-shell');
const { useCurriculumTree } = await import('../api/use-curriculum-tree');

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

function renderShell(draftVersionId: string | null, pendingModules = 0) {
  vi.mocked(useCurriculumTree).mockReturnValue({
    data: {
      versionId: 'version-1',
      containerId: 'course-1',
      levelSystem: 'cefr',
      publishState: 'published',
      containerType: 'course' as const,
      ungroupedItems: [],
      levels: [
        {
          id: 'level-a1',
          title: 'A1',
          position: 0,
          items: [],
          modules: Array.from({ length: pendingModules }, (_, i) => ({
            id: `item-mod-${i}`,
            containerId: `mod-${i}`,
            versionId: `mod-${i}-draft`,
            title: `Leksjon ${i}`,
            titleEn: null,
            position: i,
            isRequired: true,
            publishState: 'pending_changes',
            sections: [],
            ungroupedItems: [],
          })),
        },
      ],
    },
    isLoading: false,
  } as never);

  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CourseEditorShell
        container={CONTAINER}
        schoolSlug="my-school"
        draftVersionId={draftVersionId}
      />
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

  it('counts what is waiting to be published next to the review button', () => {
    renderShell('version-1', 2);
    expect(screen.getByRole('button', { name: /Review & publish/ })).toHaveTextContent('2');
  });

  it('opens the review dialog from the header button', () => {
    renderShell('version-1', 1);
    expect(screen.queryByTestId('review-publish-open')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Review & publish/ }));
    expect(screen.getByTestId('review-publish-open')).toBeInTheDocument();
  });

  it('opens the settings drawer from the header button', () => {
    renderShell('version-1');
    expect(screen.queryByTestId('settings-drawer-open')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }));
    expect(screen.getByTestId('settings-drawer-open')).toBeInTheDocument();
  });
});
