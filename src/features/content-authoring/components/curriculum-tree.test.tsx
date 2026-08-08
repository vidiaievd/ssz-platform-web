import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { CurriculumTree as CurriculumTreeData } from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';

vi.mock('../actions/container-item', () => ({
  reorderContainerItemsAction: vi.fn(),
  assignItemSectionAction: vi.fn(),
}));
// Stands in for the dialog, reporting where a new item would be filed.
vi.mock('./add-lesson-picker', () => ({
  AddLessonPicker: ({
    open,
    moduleContainerId,
    sectionId,
  }: {
    open: boolean;
    moduleContainerId: string;
    sectionId?: string | null;
  }) =>
    open ? (
      <div data-testid="add-lesson-picker" data-container={moduleContainerId}>
        {sectionId ?? 'ungrouped'}
      </div>
    ) : null,
}));
vi.mock('../actions/container', () => ({ createModuleAction: vi.fn() }));
vi.mock('../actions/section', () => ({
  createSectionAction: vi.fn(),
  reorderSectionsAction: vi.fn(),
}));

const { CurriculumTree } = await import('./curriculum-tree');
const { createModuleAction } = await import('../actions/container');
const { createSectionAction } = await import('../actions/section');

const TREE: CurriculumTreeData = {
  versionId: 'version-1',
  containerId: 'course-1',
  publishState: 'draft',
  levelSystem: 'cefr',
  containerType: 'course' as const,
  ungroupedItems: [],
  levels: [
    {
      id: 'level-a1',
      title: 'A1 — Beginner',
      position: 0,
      items: [],
      modules: [
        {
          id: 'item-module-1',
          containerId: 'module-1',
          versionId: 'module-version-1',
          title: 'Samfunn og kultur',
          titleEn: 'Society and culture',
          position: 0,
          isRequired: true,
          sections: [
            {
              id: 'section-1',
              title: 'Reinforce & read',
              position: 0,
              items: [
                {
                  id: 'item-1',
                  itemType: 'lesson',
                  refId: 'lesson-1',
                  title: 'En vanlig arbeidsdag',
                  position: 0,
                  isRequired: true,
                  lessonKind: 'text',
                  state: 'published',
                  isLive: true,
                  pendingChange: null,
                  durationMinutes: 6,
                  xpReward: 10,
                },
              ],
            },
          ],
          publishState: 'draft',
          ungroupedItems: [],
        },
      ],
    },
  ],
};

/**
 * Collapse is controlled by the shell in production, so the harness has to hold
 * it — otherwise clicking a caret here would toggle nothing.
 */
function CollapsibleTree(props: {
  tree: CurriculumTreeData;
  onSelect: (selection: CurriculumTreeSelection) => void;
  onChanged: () => void;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  return (
    <CurriculumTree
      tree={props.tree}
      selectedId={null}
      onSelect={props.onSelect}
      onChanged={props.onChanged}
      courseContainerId="course-1"
      targetLanguage="no"
      difficultyLevel="A2"
      visibility="public"
      accessTier="free_within_school"
      ownerSchoolId="school-1"
      collapsed={collapsed}
      onToggleCollapse={(key) =>
        setCollapsed((prev) => {
          const next = new Set(prev);
          if (!next.delete(key)) next.add(key);
          return next;
        })
      }
    />
  );
}

function renderTree(onSelect = vi.fn(), onChanged = vi.fn(), tree: CurriculumTreeData = TREE) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CollapsibleTree tree={tree} onSelect={onSelect} onChanged={onChanged} />
    </NextIntlClientProvider>,
  );
  return { onSelect, onChanged };
}

beforeEach(() => {
  vi.mocked(createModuleAction).mockReset();
  vi.mocked(createSectionAction).mockReset();
});

describe('CurriculumTree', () => {
  it('renders the level, its module, and section items', () => {
    renderTree();
    expect(screen.getByText('A1 — Beginner')).toBeInTheDocument();
    expect(screen.getByText('Samfunn og kultur')).toBeInTheDocument();
    // Rendered twice: once as the section header, once as the current value of
    // each item's "move to section" select.
    expect(screen.getAllByText('Reinforce & read').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('En vanlig arbeidsdag')).toBeInTheDocument();
  });

  it('selects the level on click', () => {
    const { onSelect } = renderTree();
    fireEvent.click(screen.getByText('A1 — Beginner'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'level',
        level: expect.objectContaining({ id: 'level-a1' }),
      }),
    );
  });

  it('selects the module on click', () => {
    const { onSelect } = renderTree();
    fireEvent.click(screen.getByText('Samfunn og kultur'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'module',
        module: expect.objectContaining({ id: 'item-module-1' }),
      }),
    );
  });

  it('selects a lesson item and reports its section title', () => {
    const { onSelect } = renderTree();
    fireEvent.click(screen.getByText('En vanlig arbeidsdag'));
    const call = onSelect.mock.calls[0]?.[0] as CurriculumTreeSelection;
    expect(call.kind).toBe('item');
    if (call.kind === 'item') {
      expect(call.item.id).toBe('item-1');
      expect(call.sectionTitle).toBe('Reinforce & read');
    }
  });

  it('badges an unpublished module as a draft', () => {
    renderTree();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('badges a module whose draft is ahead of what students see', () => {
    const [level] = TREE.levels;
    const [module_] = level!.modules;
    const pendingTree: CurriculumTreeData = {
      ...TREE,
      containerType: 'course' as const,
      ungroupedItems: [],
      levels: [
        {
          ...level!,
          items: [],
          modules: [{ ...module_!, publishState: 'pending_changes' }],
        },
      ],
    };

    renderTree(vi.fn(), vi.fn(), pendingTree);

    expect(screen.getByText('Unpublished changes')).toBeInTheDocument();
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
  });

  it('marks material students cannot open yet', () => {
    // The badge used to show the lesson *variant's* status, which a save sets
    // to published straight away — so freshly added material claimed to be
    // live while the row placing it sat in an unpublished draft.
    const [level] = TREE.levels;
    const [module_] = level!.modules;
    const [section] = module_!.sections;
    const [item] = section!.items;
    const pendingTree: CurriculumTreeData = {
      ...TREE,
      levels: [
        {
          ...level!,
          modules: [
            {
              ...module_!,
              sections: [{ ...section!, items: [{ ...item!, isLive: false }] }],
            },
          ],
        },
      ],
    };

    renderTree(vi.fn(), vi.fn(), pendingTree);

    expect(screen.getByText('Awaiting publish')).toBeInTheDocument();
  });

  it('stays quiet about material students already have', () => {
    // A badge on all sixteen rows of a module would bury the one that matters.
    renderTree();

    expect(screen.queryByText('Awaiting publish')).not.toBeInTheDocument();
  });

  it('names the row a reorder is waiting on', () => {
    // "Unpublished changes" on the module says a release is due; without this
    // the author has to diff sixteen rows by memory to find which one it is.
    const [level] = TREE.levels;
    const [module_] = level!.modules;
    const [section] = module_!.sections;
    const [item] = section!.items;
    const movedTree: CurriculumTreeData = {
      ...TREE,
      levels: [
        {
          ...level!,
          modules: [
            {
              ...module_!,
              publishState: 'pending_changes',
              sections: [{ ...section!, items: [{ ...item!, pendingChange: 'moved' }] }],
            },
          ],
        },
      ],
    };

    renderTree(vi.fn(), vi.fn(), movedTree);

    // Still live for students — the move is what is unpublished, not the lesson.
    expect(screen.getByText('Moved')).toBeInTheDocument();
    expect(screen.queryByText('Awaiting publish')).not.toBeInTheDocument();
  });

  it("renders the edited container's own material, not only its modules", () => {
    // A module opened in this editor keeps its lessons and exercises at the
    // level itself. Dropping them showed empty sections while pre-flight
    // complained about items the author could not see.
    const moduleTree: CurriculumTreeData = {
      ...TREE,
      containerType: 'module',
      levels: [
        {
          id: 'section-nye-ord',
          title: 'Nye ord',
          position: 0,
          modules: [],
          items: [
            {
              id: 'own-item-1',
              itemType: 'exercise',
              refId: 'exercise-9',
              title: 'Fyll inn ordet',
              position: 0,
              isRequired: true,
              lessonKind: null,
              state: null,
              isLive: false,
              pendingChange: null,
              durationMinutes: 2,
              xpReward: 5,
            },
          ],
        },
      ],
    };

    const { onSelect } = renderTree(vi.fn(), vi.fn(), moduleTree);

    expect(screen.getByText('Fyll inn ordet')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Fyll inn ordet'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'item', sectionTitle: 'Nye ord' }),
    );
  });

  it('collapses a level so its modules are no longer rendered', () => {
    renderTree();
    const [levelToggle] = screen.getAllByRole('button', { name: 'Collapse' });
    fireEvent.click(levelToggle!);
    expect(screen.queryByText('Samfunn og kultur')).not.toBeInTheDocument();
  });

  it('shows the "no lessons yet" placeholder for an empty section', () => {
    const [level] = TREE.levels;
    const [module_] = level!.modules;
    const emptyTree: CurriculumTreeData = {
      ...TREE,
      containerType: 'course' as const,
      ungroupedItems: [],
      levels: [
        {
          ...level!,
          items: [],
          modules: [
            {
              ...module_!,
              sections: [{ id: 'section-2', title: 'Empty section', position: 0, items: [] }],
            },
          ],
        },
      ],
    };
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CurriculumTree
          tree={emptyTree}
          selectedId={null}
          onSelect={vi.fn()}
          onChanged={vi.fn()}
          courseContainerId="course-1"
          targetLanguage="no"
          difficultyLevel="A2"
          visibility="public"
          accessTier="free_within_school"
          collapsed={new Set()}
          onToggleCollapse={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('No lessons yet')).toBeInTheDocument();
  });

  it('creates a new level and reports it for selection', async () => {
    vi.mocked(createSectionAction).mockResolvedValue({
      ok: true,
      value: { sectionId: 'level-b1', position: 1 },
    } as never);
    const { onChanged } = renderTree();

    fireEvent.click(screen.getByRole('button', { name: 'Add level' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('level-b1', 'level'));
    expect(createSectionAction).toHaveBeenCalledWith('course-1', 'New level');
  });

  it('creates a new module under a level and reports it for selection', async () => {
    vi.mocked(createModuleAction).mockResolvedValue({
      ok: true,
      value: { moduleContainerId: 'module-2', itemId: 'item-module-2' },
    } as never);
    const { onChanged } = renderTree();

    fireEvent.click(screen.getByRole('button', { name: 'Add module' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('item-module-2', 'module'));
    expect(createModuleAction).toHaveBeenCalledWith(
      'course-1',
      'New module',
      'no',
      'A2',
      'public',
      'free_within_school',
      'level-a1',
      // Without the owning school the backend rejects `school_private` modules.
      'school-1',
    );
  });

  it('shows an error toast and does not report a change on creation failure', async () => {
    vi.mocked(createSectionAction).mockResolvedValue({
      ok: false,
      error: { code: 'validation' },
    } as never);
    const { onChanged } = renderTree();

    fireEvent.click(screen.getByRole('button', { name: 'Add level' }));

    await waitFor(() => expect(createSectionAction).toHaveBeenCalled());
    expect(onChanged).not.toHaveBeenCalled();
  });
  it('offers a module its own material, not more modules', () => {
    // The same screen edits courses and modules. Offering "Add module" in a
    // module left its lessons addable only from the parent course editor.
    const moduleTree: CurriculumTreeData = {
      ...TREE,
      containerType: 'module',
      levels: [{ id: 'section-nye-ord', title: 'Nye ord', position: 0, modules: [], items: [] }],
    };

    renderTree(vi.fn(), vi.fn(), moduleTree);

    expect(screen.getByRole('button', { name: 'Add lesson' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add module' })).not.toBeInTheDocument();
  });

  it('files what a module adds into the section it was added from', () => {
    const moduleTree: CurriculumTreeData = {
      ...TREE,
      containerType: 'module',
      levels: [{ id: 'section-nye-ord', title: 'Nye ord', position: 0, modules: [], items: [] }],
    };

    renderTree(vi.fn(), vi.fn(), moduleTree);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add lesson' })[0]!);

    const picker = screen.getByTestId('add-lesson-picker');
    // The edited container itself, not one of its children.
    expect(picker).toHaveAttribute('data-container', 'course-1');
    expect(picker).toHaveTextContent('section-nye-ord');
  });

  it('lets a module with no sections add material anyway', () => {
    const moduleTree: CurriculumTreeData = {
      ...TREE,
      containerType: 'module',
      levels: [],
      ungroupedItems: [],
    };

    renderTree(vi.fn(), vi.fn(), moduleTree);
    fireEvent.click(screen.getByRole('button', { name: 'Add lesson' }));

    expect(screen.getByTestId('add-lesson-picker')).toHaveTextContent('ungrouped');
  });

  it('still builds a course out of modules', () => {
    renderTree();

    expect(screen.getByRole('button', { name: 'Add module' })).toBeInTheDocument();
    expect(screen.queryByTestId('add-lesson-picker')).not.toBeInTheDocument();
  });
});
