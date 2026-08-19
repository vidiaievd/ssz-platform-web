import { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { CurriculumTree as CurriculumTreeData } from '@/features/content/types';

import type { CurriculumTreeSelection } from '../types';
import { EMPTY_FILTERS, type StructureFilters } from '../lib/structure-filters';

vi.mock('../actions/container-item', () => ({
  reorderContainerItemsAction: vi.fn(),
  assignItemSectionAction: vi.fn(),
  removeContainerItemAction: vi.fn(),
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
vi.mock('../actions/container', () => ({
  createModuleAction: vi.fn(),
  renameContainerAction: vi.fn(),
}));
const routerPush = vi.fn();

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
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
vi.mock('../actions/rename-item', () => ({ renameItemAction: vi.fn() }));
vi.mock('../actions/section', () => ({
  createSectionAction: vi.fn(),
  renameSectionAction: vi.fn(),
  reorderSectionsAction: vi.fn(),
  deleteSectionAction: vi.fn(),
}));

const { CurriculumTree } = await import('./curriculum-tree');
const { createModuleAction } = await import('../actions/container');
const { createSectionAction } = await import('../actions/section');
const { renameContainerAction } = await import('../actions/container');
const { renameItemAction } = await import('../actions/rename-item');
const { assignItemSectionAction, reorderContainerItemsAction, removeContainerItemAction } =
  await import('../actions/container-item');
const { deleteSectionAction } = await import('../actions/section');

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
  filters?: StructureFilters;
  selectedId?: string | null;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  return (
    <CurriculumTree
      tree={props.tree}
      selectedId={props.selectedId ?? null}
      onSelect={props.onSelect}
      onChanged={props.onChanged}
      courseContainerId="course-1"
      schoolSlug="my-school"
      filters={props.filters ?? EMPTY_FILTERS}
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

function renderTree(
  onSelect = vi.fn(),
  onChanged = vi.fn(),
  tree: CurriculumTreeData = TREE,
  filters?: StructureFilters,
  selectedId?: string,
) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CollapsibleTree
        tree={tree}
        onSelect={onSelect}
        onChanged={onChanged}
        filters={filters}
        selectedId={selectedId}
      />
    </NextIntlClientProvider>,
  );
  return { onSelect, onChanged };
}

beforeEach(() => {
  vi.mocked(createModuleAction).mockReset();
  vi.mocked(createSectionAction).mockReset();
  vi.mocked(renameContainerAction).mockReset();
  vi.mocked(renameItemAction).mockReset();
  vi.mocked(reorderContainerItemsAction).mockReset();
  vi.mocked(assignItemSectionAction).mockReset();
  vi.mocked(removeContainerItemAction).mockReset();
  vi.mocked(deleteSectionAction).mockReset();
  routerPush.mockReset();
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
    expect(within(screen.getByRole('article')).getByText('Draft')).toBeInTheDocument();
  });

  // A level is a section, not a container, so it has no state of its own. The
  // badge an author expects on "Leksjon 1" is a roll-up of what is inside it.
  it('rolls a module\u2019s state up onto its level', () => {
    renderTree();
    const levelHeader = screen.getByText('A1 — Beginner').closest('header')!;
    expect(within(levelHeader).getByText('Draft')).toBeInTheDocument();
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

    const moduleCard = within(screen.getByRole('article'));
    expect(moduleCard.getByText('Unpublished changes')).toBeInTheDocument();
    expect(moduleCard.queryByText('Draft')).not.toBeInTheDocument();
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

  it('links a block row straight to its editor', () => {
    renderTree();
    const row = screen.getByRole('group', { name: 'En vanlig arbeidsdag' });
    expect(within(row).getByRole('link', { name: 'Open lesson editor' })).toHaveAttribute(
      'href',
      '/school/my-school/content/module-1/lessons/item-1',
    );
  });

  // Duplicate has no backend (plan 38 §3 B1). It is rendered where the design
  // puts it, but announced as unavailable rather than silently doing nothing.
  it('offers duplicate as a control that says it is not connected yet', () => {
    renderTree();
    const row = screen.getByRole('group', { name: 'En vanlig arbeidsdag' });
    const duplicate = within(row).getByRole('button', { name: /Duplicate/ });
    expect(duplicate).toHaveAttribute('aria-disabled', 'true');
    expect(duplicate).toHaveAccessibleName('Duplicate — not available yet');
  });

  describe('the row menu', () => {
    // Radix opens on pointer events, so these go through user-event rather
    // than fireEvent.click.
    async function openMenu(name: string) {
      await userEvent.click(screen.getByRole('button', { name: `More actions for ${name}` }));
      return screen.findByRole('menu');
    }

    const openItemMenu = () => openMenu('En vanlig arbeidsdag');

    it('starts a rename from the menu', async () => {
      renderTree();
      const menu = await openItemMenu();

      await userEvent.click(within(menu).getByText('Rename'));

      expect(await screen.findByDisplayValue('En vanlig arbeidsdag')).toBeInTheDocument();
    });

    it('links to the editor from the menu', async () => {
      renderTree();
      const menu = await openItemMenu();

      expect(
        within(menu).getByRole('menuitem', { name: new RegExp('Open lesson editor') }),
      ).toHaveAttribute('href', '/school/my-school/content/module-1/lessons/item-1');
    });

    // Duplicate and per-block publishing have no backend (plan 38 §3), so the
    // menu lists them but cannot run them.
    it('marks the actions that have no backend as unavailable', async () => {
      renderTree();
      const menu = await openItemMenu();

      expect(within(menu).getByRole('menuitem', { name: /Duplicate/ })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(within(menu).getByRole('menuitem', { name: /Unpublish/ })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('disables moving a block that is alone in its section', async () => {
      renderTree();
      const menu = await openItemMenu();

      expect(within(menu).getByRole('menuitem', { name: new RegExp('Move up') })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(within(menu).getByRole('menuitem', { name: new RegExp('Move down') })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('reorders a block by submitting the module\u2019s full item order', async () => {
      const [level] = TREE.levels;
      const [module_] = level!.modules;
      const [section] = module_!.sections;
      const [first] = section!.items;
      const twoItems: CurriculumTreeData = {
        ...TREE,
        levels: [
          {
            ...level!,
            modules: [
              {
                ...module_!,
                sections: [
                  {
                    ...section!,
                    items: [first!, { ...first!, id: 'item-2', title: 'Andre tekst' }],
                  },
                ],
              },
            ],
          },
        ],
      };
      vi.mocked(reorderContainerItemsAction).mockResolvedValue({
        ok: true,
        value: undefined,
      } as never);

      renderTree(vi.fn(), vi.fn(), twoItems);
      const menu = await openMenu('Andre tekst');
      await userEvent.click(within(menu).getByRole('menuitem', { name: new RegExp('Move up') }));

      await waitFor(() =>
        expect(reorderContainerItemsAction).toHaveBeenCalledWith('module-1', ['item-2', 'item-1']),
      );
    });

    it('files a block into another section from the menu', async () => {
      vi.mocked(assignItemSectionAction).mockResolvedValue({ ok: true, value: undefined } as never);
      renderTree();
      const menu = await openItemMenu();

      await userEvent.click(within(menu).getByRole('menuitem', { name: 'Move to…' }));
      const submenu = await screen.findByRole('menu', { name: 'Move to…' });
      await userEvent.click(within(submenu).getByRole('menuitem', { name: 'No section' }));

      await waitFor(() =>
        expect(assignItemSectionAction).toHaveBeenCalledWith('module-1', 'item-1', null),
      );
    });
  });

  describe('deletion', () => {
    it('unplaces a block rather than destroying the material behind it', async () => {
      vi.mocked(removeContainerItemAction).mockResolvedValue({
        ok: true,
        value: undefined,
      } as never);
      const { onChanged } = renderTree();

      await userEvent.click(
        screen.getByRole('button', { name: 'More actions for En vanlig arbeidsdag' }),
      );
      await userEvent.click(
        within(await screen.findByRole('menu')).getByRole('menuitem', {
          name: new RegExp('Remove…'),
        }),
      );

      const dialog = await screen.findByRole('alertdialog');
      expect(
        within(dialog).getByText(/stays in your library and can be placed again/),
      ).toBeInTheDocument();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Remove block' }));

      // The row's own module owns it, not the course.
      await waitFor(() =>
        expect(removeContainerItemAction).toHaveBeenCalledWith('module-1', 'item-1'),
      );
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it('counts what a module holds before removing it', async () => {
      renderTree();

      await userEvent.click(
        screen.getByRole('button', { name: 'More actions for Samfunn og kultur' }),
      );
      await userEvent.click(
        within(await screen.findByRole('menu')).getByRole('menuitem', {
          name: new RegExp('Remove…'),
        }),
      );

      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText(/1 block/)).toBeInTheDocument();
    });

    // A level is the one kind genuinely deleted — and its modules survive it.
    it('warns that deleting a level leaves its modules ungrouped', async () => {
      vi.mocked(deleteSectionAction).mockResolvedValue({ ok: true, value: undefined } as never);
      renderTree();

      await userEvent.click(screen.getByRole('button', { name: 'More actions for A1 — Beginner' }));
      await userEvent.click(
        within(await screen.findByRole('menu')).getByRole('menuitem', {
          name: new RegExp('Delete…'),
        }),
      );

      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText(/without a level to group them/)).toBeInTheDocument();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete level' }));

      await waitFor(() => expect(deleteSectionAction).toHaveBeenCalledWith('course-1', 'level-a1'));
    });

    it('keeps the node when the dialog is cancelled', async () => {
      renderTree();

      await userEvent.click(
        screen.getByRole('button', { name: 'More actions for En vanlig arbeidsdag' }),
      );
      await userEvent.click(
        within(await screen.findByRole('menu')).getByRole('menuitem', {
          name: new RegExp('Remove…'),
        }),
      );
      await userEvent.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
      );

      expect(removeContainerItemAction).not.toHaveBeenCalled();
    });
  });

  describe('drag and drop', () => {
    it('gives a block in a module a drag handle', () => {
      renderTree();
      expect(
        screen.getByRole('button', { name: 'Drag to move En vanlig arbeidsdag' }),
      ).toBeInTheDocument();
    });

    it('gives a level a drag handle of its own', () => {
      renderTree();
      expect(
        screen.getByRole('button', { name: 'Drag to move level A1 — Beginner' }),
      ).toBeInTheDocument();
    });

    it('gives a module a drag handle of its own', () => {
      renderTree();
      expect(
        screen.getByRole('button', { name: 'Drag to move module Samfunn og kultur' }),
      ).toBeInTheDocument();
    });

    // Modules and the material placed on the course itself share one item list,
    // so both are draggable and both must be in the order that gets submitted.
    it("gives the container's own material a handle too", () => {
      const treeWithOwnItem: CurriculumTreeData = {
        ...TREE,
        levels: [
          {
            ...TREE.levels[0]!,
            items: [
              {
                ...TREE.levels[0]!.modules[0]!.sections[0]!.items[0]!,
                id: 'own-item',
                title: 'Kursintro',
              },
            ],
          },
        ],
      };
      renderTree(vi.fn(), vi.fn(), treeWithOwnItem);

      expect(screen.getByRole('button', { name: 'Drag to move Kursintro' })).toBeInTheDocument();
    });
  });

  describe('multi-select', () => {
    /** Two blocks in two different modules — the case a bulk action must not flatten. */
    const LEVEL = TREE.levels[0]!;
    const MODULE_ONE = LEVEL.modules[0]!;
    const ITEM_ONE = MODULE_ONE.sections[0]!.items[0]!;
    const TREE_TWO_MODULES: CurriculumTreeData = {
      ...TREE,
      levels: [
        {
          ...LEVEL,
          modules: [
            MODULE_ONE,
            {
              ...MODULE_ONE,
              id: 'item-module-2',
              containerId: 'module-2',
              title: 'Helse',
              sections: [
                {
                  id: 'section-2',
                  title: 'Øvelser',
                  position: 0,
                  items: [
                    {
                      ...ITEM_ONE,
                      id: 'item-2',
                      refId: 'lesson-2',
                      title: 'Hos legen',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    async function tick(name: string) {
      await userEvent.click(screen.getByRole('checkbox', { name: `Select ${name}` }));
    }

    it('counts ticked blocks without moving the inspector to them', async () => {
      const { onSelect } = renderTree(vi.fn(), vi.fn(), TREE_TWO_MODULES);

      await tick('En vanlig arbeidsdag');
      await tick('Hos legen');

      expect(screen.getByText('2 selected')).toBeInTheDocument();
      // Ticking says "act on these", not "show me this one".
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('clears the selection on Escape', async () => {
      renderTree(vi.fn(), vi.fn(), TREE_TWO_MODULES);

      await tick('En vanlig arbeidsdag');
      expect(screen.getByText('1 selected')).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');

      expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    });

    it('offers the actions with no backend as unavailable', async () => {
      renderTree(vi.fn(), vi.fn(), TREE_TWO_MODULES);
      await tick('Hos legen');

      // Scoped to the bar: rows carry a stub Duplicate of their own.
      const bar = screen.getByRole('toolbar', { name: /Bulk actions/ });
      for (const label of ['Duplicate', 'Publish', 'Unpublish']) {
        expect(
          within(bar).getByRole('button', { name: `${label} — not available yet` }),
        ).toHaveAttribute('aria-disabled', 'true');
      }
    });

    it('removes every ticked block from the container that holds it', async () => {
      vi.mocked(removeContainerItemAction).mockResolvedValue({
        ok: true,
        value: undefined,
      } as never);
      const { onChanged } = renderTree(vi.fn(), vi.fn(), TREE_TWO_MODULES);

      await tick('En vanlig arbeidsdag');
      await tick('Hos legen');
      await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

      const dialog = await screen.findByRole('alertdialog');
      // Named by count, not by one of the two titles it is about to remove.
      expect(within(dialog).getByText(/2 blocks/)).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Remove blocks' }));

      await waitFor(() =>
        expect(removeContainerItemAction).toHaveBeenCalledWith('module-1', 'item-1'),
      );
      expect(removeContainerItemAction).toHaveBeenCalledWith('module-2', 'item-2');
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      // The bar goes once the blocks it acted on are gone.
      await waitFor(() => expect(screen.queryByText('2 selected')).not.toBeInTheDocument());
    });

    it('keeps a block that could not be removed ticked', async () => {
      vi.mocked(removeContainerItemAction).mockImplementation(
        async (containerId: string) =>
          (containerId === 'module-1'
            ? { ok: true, value: undefined }
            : { ok: false, error: { code: 'unknown' } }) as never,
      );
      renderTree(vi.fn(), vi.fn(), TREE_TWO_MODULES);

      await tick('En vanlig arbeidsdag');
      await tick('Hos legen');
      await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
      await userEvent.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'Remove blocks',
        }),
      );

      await waitFor(() => expect(screen.getByText('1 selected')).toBeInTheDocument());
      expect(screen.getByRole('checkbox', { name: 'Select Hos legen' })).toBeChecked();
    });
  });

  describe('inline rename', () => {
    it('renames a module through its container endpoint', async () => {
      vi.mocked(renameContainerAction).mockResolvedValue({ ok: true, value: undefined } as never);
      const { onChanged } = renderTree();

      fireEvent.doubleClick(screen.getByText('Samfunn og kultur'));
      const input = screen.getByDisplayValue('Samfunn og kultur');
      fireEvent.change(input, { target: { value: 'Arbeidsliv' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(renameContainerAction).toHaveBeenCalledWith('module-1', 'Arbeidsliv'),
      );
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it('renames a block through the entity its row points at', async () => {
      vi.mocked(renameItemAction).mockResolvedValue({ ok: true, value: undefined } as never);
      renderTree();

      fireEvent.doubleClick(screen.getByText('En vanlig arbeidsdag'));
      const input = screen.getByDisplayValue('En vanlig arbeidsdag');
      fireEvent.change(input, { target: { value: 'En travel dag' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(renameItemAction).toHaveBeenCalledWith(
          'lesson',
          'lesson-1',
          'course-1',
          'En travel dag',
        ),
      );
    });

    it('discards the edit on Escape', async () => {
      renderTree();

      fireEvent.doubleClick(screen.getByText('Samfunn og kultur'));
      const input = screen.getByDisplayValue('Samfunn og kultur');
      fireEvent.change(input, { target: { value: 'Something else' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(renameContainerAction).not.toHaveBeenCalled();
      expect(screen.getByText('Samfunn og kultur')).toBeInTheDocument();
    });

    // An exercise row is labelled by its template's name; there is no
    // per-exercise title field to write to.
    it('does not offer rename on an exercise row', () => {
      const [level] = TREE.levels;
      const [module_] = level!.modules;
      const [section] = module_!.sections;
      const [item] = section!.items;
      const exerciseTree: CurriculumTreeData = {
        ...TREE,
        levels: [
          {
            ...level!,
            modules: [
              {
                ...module_!,
                sections: [
                  {
                    ...section!,
                    items: [
                      {
                        ...item!,
                        itemType: 'exercise',
                        lessonKind: null,
                        title: 'Gap-Fill',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      renderTree(vi.fn(), vi.fn(), exerciseTree);
      fireEvent.doubleClick(screen.getByText('Gap-Fill'));

      expect(screen.queryByDisplayValue('Gap-Fill')).not.toBeInTheDocument();
    });
  });

  describe('under filters', () => {
    // The UX rule: a search is a question about the whole course, so the tree
    // opens what holds an answer and folds away what does not — including nodes
    // the author had left open.
    it('folds a level whose blocks none match, keeping its header in place', () => {
      renderTree(vi.fn(), vi.fn(), TREE, { ...EMPTY_FILTERS, query: 'zzz' });

      expect(screen.getByText('A1 — Beginner')).toBeInTheDocument();
      expect(screen.queryByText('Samfunn og kultur')).not.toBeInTheDocument();
      expect(screen.queryByText('En vanlig arbeidsdag')).not.toBeInTheDocument();
    });

    it('opens the level and the module holding a match', () => {
      renderTree(vi.fn(), vi.fn(), TREE, { ...EMPTY_FILTERS, query: 'arbeidsdag' });

      expect(screen.getByText('A1 — Beginner')).toBeInTheDocument();
      expect(screen.getByText('Samfunn og kultur')).toBeInTheDocument();
      expect(screen.getByText('En vanlig arbeidsdag')).toBeInTheDocument();
    });

    it('hides a section that has no matches instead of calling it empty', () => {
      const [level] = TREE.levels;
      const [module_] = level!.modules;
      const [section] = module_!.sections;
      const twoSections: CurriculumTreeData = {
        ...TREE,
        levels: [
          {
            ...level!,
            modules: [
              {
                ...module_!,
                sections: [section!, { id: 'section-2', title: 'Øvelser', position: 1, items: [] }],
              },
            ],
          },
        ],
      };

      renderTree(vi.fn(), vi.fn(), twoSections, { ...EMPTY_FILTERS, query: 'arbeidsdag' });

      expect(screen.getAllByText('Reinforce & read').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Øvelser')).not.toBeInTheDocument();
      expect(screen.queryByText('No lessons yet')).not.toBeInTheDocument();
    });

    it('filters by block type', () => {
      const { unmount } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <CollapsibleTree
            tree={TREE}
            onSelect={vi.fn()}
            onChanged={vi.fn()}
            filters={{ ...EMPTY_FILTERS, type: 'exercises' }}
          />
        </NextIntlClientProvider>,
      );
      expect(screen.queryByText('En vanlig arbeidsdag')).not.toBeInTheDocument();
      unmount();

      renderTree(vi.fn(), vi.fn(), TREE, { ...EMPTY_FILTERS, type: 'text' });
      expect(screen.getByText('En vanlig arbeidsdag')).toBeInTheDocument();
    });

    // The author's own collapse state is only masked, never overwritten.
    it('restores what the author had collapsed once the filters are cleared', () => {
      const { rerender } = render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <CollapsibleTree tree={TREE} onSelect={vi.fn()} onChanged={vi.fn()} />
        </NextIntlClientProvider>,
      );

      const [levelToggle] = screen.getAllByRole('button', { name: 'Collapse' });
      fireEvent.click(levelToggle!);
      expect(screen.queryByText('Samfunn og kultur')).not.toBeInTheDocument();

      const withFilter = (filters?: StructureFilters) => (
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <CollapsibleTree tree={TREE} onSelect={vi.fn()} onChanged={vi.fn()} filters={filters} />
        </NextIntlClientProvider>
      );

      rerender(withFilter({ ...EMPTY_FILTERS, query: 'arbeidsdag' }));
      expect(screen.getByText('Samfunn og kultur')).toBeInTheDocument();

      rerender(withFilter());
      expect(screen.queryByText('Samfunn og kultur')).not.toBeInTheDocument();
    });
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
          schoolSlug="my-school"
          filters={EMPTY_FILTERS}
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
  describe('the keyboard model', () => {
    /** The fixture with a second block, so there is somewhere to move. */
    const TWO_BLOCKS: CurriculumTreeData = {
      ...TREE,
      levels: [
        {
          ...TREE.levels[0]!,
          modules: [
            {
              ...TREE.levels[0]!.modules[0]!,
              sections: [
                {
                  ...TREE.levels[0]!.modules[0]!.sections[0]!,
                  items: [
                    TREE.levels[0]!.modules[0]!.sections[0]!.items[0]!,
                    {
                      ...TREE.levels[0]!.modules[0]!.sections[0]!.items[0]!,
                      id: 'item-2',
                      refId: 'lesson-2',
                      title: 'Hva gjør du?',
                      position: 1,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    it('moves the selected block with ⌥↓, planned the way a drag would be', async () => {
      vi.mocked(reorderContainerItemsAction).mockResolvedValue({
        ok: true,
        value: undefined,
      } as never);
      renderTree(vi.fn(), vi.fn(), TWO_BLOCKS, undefined, 'item-1');

      fireEvent.keyDown(document, { key: 'ArrowDown', altKey: true });

      await waitFor(() =>
        expect(reorderContainerItemsAction).toHaveBeenCalledWith('module-1', ['item-2', 'item-1']),
      );
    });

    it('does nothing at the end of a list', async () => {
      renderTree(vi.fn(), vi.fn(), TWO_BLOCKS, undefined, 'item-2');

      fireEvent.keyDown(document, { key: 'ArrowDown', altKey: true });

      await waitFor(() => expect(reorderContainerItemsAction).not.toHaveBeenCalled());
    });

    it('opens the inline rename on F2', () => {
      renderTree(vi.fn(), vi.fn(), TREE, undefined, 'item-module-1');

      fireEvent.keyDown(document, { key: 'F2' });

      expect(screen.getByDisplayValue('Samfunn og kultur')).toBeInTheDocument();
    });

    it('asks before removing the selection on ⌫, counting what it holds', async () => {
      renderTree(vi.fn(), vi.fn(), TREE, undefined, 'item-module-1');

      fireEvent.keyDown(document, { key: 'Backspace' });

      expect(
        await screen.findByText('Remove “Samfunn og kultur” from this course?'),
      ).toBeInTheDocument();
    });

    it('leaves the keys to the field being typed in', () => {
      renderTree(vi.fn(), vi.fn(), TREE, undefined, 'item-module-1');
      fireEvent.keyDown(document, { key: 'F2' });

      fireEvent.keyDown(screen.getByDisplayValue('Samfunn og kultur'), { key: 'Backspace' });

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('opens the selected block’s editor on Enter', () => {
      renderTree(vi.fn(), vi.fn(), TREE, undefined, 'item-1');

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(routerPush).toHaveBeenCalledWith('/school/my-school/content/module-1/lessons/item-1');
    });
  });
});
