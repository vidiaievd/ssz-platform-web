import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { CurriculumTree as CurriculumTreeData } from '@/features/content/types';

vi.mock('../api/use-curriculum-tree', () => ({ useCurriculumTree: vi.fn() }));
vi.mock('../actions/container-item', () => ({
  reorderContainerItemsAction: vi.fn(),
  assignItemSectionAction: vi.fn(),
}));
vi.mock('./add-lesson-picker', () => ({ AddLessonPicker: () => null }));
vi.mock('./module-publish-block', () => ({ ModulePublishBlock: () => null }));
vi.mock('../actions/container', () => ({
  renameContainerAction: vi.fn(),
  createModuleAction: vi.fn(),
}));
vi.mock('../actions/section', () => ({
  renameSectionAction: vi.fn(),
  createSectionAction: vi.fn(),
  reorderSectionsAction: vi.fn(),
}));
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { CourseStructurePanel } = await import('./course-structure-panel');
import { useCurriculumTree } from '../api/use-curriculum-tree';

const EMPTY_TREE: CurriculumTreeData = {
  versionId: 'version-1',
  containerId: 'course-1',
  levelSystem: 'cefr',
  levels: [],
};

const ONE_LEVEL_TREE: CurriculumTreeData = {
  ...EMPTY_TREE,
  levels: [{ id: 'level-a1', title: 'A1 — Beginner', position: 0, modules: [] }],
};

function renderPanel() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CourseStructurePanel
        containerId="course-1"
        versionId="version-1"
        schoolSlug="my-school"
        targetLanguage="no"
        difficultyLevel="A2"
        visibility="public"
        accessTier="free_within_school"
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.mocked(useCurriculumTree).mockReset());

describe('CourseStructurePanel', () => {
  it('renders a loading skeleton while the tree is loading', () => {
    vi.mocked(useCurriculumTree).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderPanel();
    expect(screen.queryByText('Curriculum')).not.toBeInTheDocument();
  });

  it('renders an error state with retry on failure', () => {
    const refetch = vi.fn();
    vi.mocked(useCurriculumTree).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as never);
    renderPanel();
    expect(screen.getByText('Could not load the curriculum tree.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders the empty state when a course has no levels', () => {
    vi.mocked(useCurriculumTree).mockReturnValue({
      data: EMPTY_TREE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderPanel();
    expect(screen.getByText('This course has no levels yet.')).toBeInTheDocument();
  });

  it('renders the tree and inspector, and loads the inspector on selection', () => {
    vi.mocked(useCurriculumTree).mockReturnValue({
      data: ONE_LEVEL_TREE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderPanel();
    expect(
      screen.getByText('Select an item to inspect and edit its settings.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('A1 — Beginner'));
    expect(
      screen.queryByText('Select an item to inspect and edit its settings.'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Levels group modules and map to CEFR bands students see in the reader.'),
    ).toBeInTheDocument();
  });
});
