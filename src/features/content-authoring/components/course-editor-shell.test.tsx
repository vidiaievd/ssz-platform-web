import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container } from '@/features/content/types';

vi.mock('./course-settings-drawer', () => ({
  CourseSettingsDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="settings-drawer-open" /> : null,
}));
// The view lives in the URL, so the test drives it the way the browser does.
let searchParams = new URLSearchParams();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ replace }),
  usePathname: () => '/w/my-school/content/course-1',
}));
vi.mock('../api/use-curriculum-tree', () => ({ useCurriculumTree: vi.fn() }));
// The real dialog pulls in the publish server action, which cannot load in a
// client test environment.
vi.mock('./review-publish-dialog', () => ({
  ReviewPublishDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="review-publish-open" /> : null,
}));
// Counts the course through react-query, which this shell test does not stand
// up; it is exercised in `coverage-strip.test.tsx`.
vi.mock('./coverage-strip', () => ({
  CoverageStrip: ({ containerId }: { containerId: string }) => (
    <div data-testid="coverage-strip" data-container={containerId} />
  ),
}));
// Same reason as the strip above: two react-query hooks, exercised in
// `coverage-result-grid.test.tsx`.
vi.mock('./coverage-result-grid', () => ({
  CoverageResultGrid: ({ containerId }: { containerId: string }) => (
    <div data-testid="coverage-result-grid" data-container={containerId} />
  ),
}));
// And the fact-level report beside it, for the same reason again — its own behaviour is
// exercised in `atom-coverage-report.test.tsx`.
vi.mock('./atom-coverage-report', () => ({
  AtomCoverageReport: ({ containerId }: { containerId: string }) => (
    <div data-testid="atom-coverage-report" data-container={containerId} />
  ),
}));
vi.mock('./course-structure-panel', () => ({
  CourseStructurePanel: ({
    containerId,
    versionId,
    collapsed,
    onExpandAll,
    onCollapseAll,
  }: {
    containerId: string;
    versionId: string;
    collapsed: ReadonlySet<string>;
    onExpandAll: () => void;
    onCollapseAll: () => void;
  }) => (
    <div data-testid="course-structure-panel" data-collapsed={[...collapsed].join(',')}>
      {containerId}/{versionId}
      <button onClick={onExpandAll}>Expand all</button>
      <button onClick={onCollapseAll}>Collapse all</button>
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

function renderShell(draftVersionId: string | null, pendingModules = 0, view?: string) {
  searchParams = new URLSearchParams(view ? `view=${view}` : '');
  replace.mockClear();
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
        workspaceId="my-school"
        draftVersionId={draftVersionId}
        publishedVersionNumber={2}
      />
    </NextIntlClientProvider>,
  );
}

describe('CourseEditorShell', () => {
  it('renders the curriculum tree panel as the primary surface', () => {
    renderShell('version-1');
    expect(screen.getByTestId('course-structure-panel')).toHaveTextContent('course-1/version-1');
  });

  // Two views of one screen (plan 64, phase 0). The tree is what opens; the
  // report is a tab away and, above all, a link away.
  it('opens on the tree and keeps the report off screen', () => {
    renderShell('version-1');
    expect(screen.getByTestId('course-structure-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('coverage-strip')).not.toBeInTheDocument();
  });

  it('says what the course trains when the report is the view asked for', () => {
    renderShell('version-1', 0, 'coverage');
    expect(screen.getByTestId('coverage-strip')).toHaveAttribute('data-container', 'course-1');
    expect(screen.getByTestId('atom-coverage-report')).toHaveAttribute(
      'data-container',
      'course-1',
    );
    expect(screen.queryByTestId('course-structure-panel')).not.toBeInTheDocument();
  });

  it('puts the view in the URL rather than in state, so the report can be linked to', () => {
    renderShell('version-1');
    fireEvent.click(screen.getByRole('tab', { name: 'Coverage' }));
    expect(replace).toHaveBeenCalledWith(
      '/w/my-school/content/course-1?view=coverage',
      expect.objectContaining({ scroll: false }),
    );
  });

  // The structure tab is the default, so it is spelt by the absence of the
  // parameter — otherwise every course URL would carry a redundant tail.
  it('drops the parameter on the way back to the tree', () => {
    renderShell('version-1', 0, 'coverage');
    fireEvent.click(screen.getByRole('tab', { name: 'Structure' }));
    expect(replace).toHaveBeenCalledWith(
      '/w/my-school/content/course-1',
      expect.objectContaining({ scroll: false }),
    );
  });

  it('counts the course in the header whichever view is open', () => {
    renderShell('version-1', 2, 'coverage');
    expect(screen.getByText('Modules').closest('div')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /Review & publish/ })).toHaveTextContent('2');
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

  // BEHAVIOR.md §5.2: the strip, the review badge and the dialog must never
  // disagree about how much is waiting, so they read the same number.
  it('shows the same unpublished count in the metric strip and on the review button', () => {
    renderShell('version-1', 2);
    const unpublished = screen.getByText('Unpublished').closest('div');
    expect(unpublished).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /Review & publish/ })).toHaveTextContent('2');
  });

  it('sizes the course in the metric strip', () => {
    renderShell('version-1', 2);
    expect(screen.getByText('Levels').closest('div')).toHaveTextContent('1');
    expect(screen.getByText('Modules').closest('div')).toHaveTextContent('2');
  });

  // Collapse state lives in the shell precisely so these two buttons, which sit
  // above the tree, can drive every node at once.
  it('folds and unfolds every level and module from the tree toolbar', () => {
    renderShell('version-1', 2);
    const panel = () => screen.getByTestId('course-structure-panel');
    expect(panel()).toHaveAttribute('data-collapsed', '');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(panel()).toHaveAttribute(
      'data-collapsed',
      'level:level-a1,module:item-mod-0,module:item-mod-1',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(panel()).toHaveAttribute('data-collapsed', '');
  });
});
