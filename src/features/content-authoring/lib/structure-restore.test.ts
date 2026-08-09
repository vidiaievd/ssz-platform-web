import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CurriculumTree, CurriculumTreeItemNode } from '@/features/content/types';

vi.mock('../actions/container-item', () => ({ restoreContainerItemsAction: vi.fn() }));
vi.mock('../actions/section', () => ({ restoreSectionAction: vi.fn() }));

const { describeLevelRemoval, describeRemoval, levelRemovalUndo, rowRemovalUndo } =
  await import('./structure-restore');
const { restoreContainerItemsAction } = await import('../actions/container-item');
const { restoreSectionAction } = await import('../actions/section');

function item(id: string, overrides: Partial<CurriculumTreeItemNode> = {}): CurriculumTreeItemNode {
  return {
    id,
    itemType: 'lesson',
    refId: `ref-${id}`,
    title: id,
    position: 0,
    isRequired: true,
    lessonKind: 'text',
    state: 'published',
    isLive: true,
    pendingChange: null,
    durationMinutes: null,
    xpReward: null,
    ...overrides,
  };
}

/** One level holding a module (a b | c) and a piece of the course's own material (d). */
const TREE: CurriculumTree = {
  versionId: 'version-1',
  containerId: 'course-1',
  containerType: 'course',
  levelSystem: 'cefr',
  publishState: 'draft',
  levels: [
    {
      id: 'level-a1',
      title: 'A1',
      position: 0,
      modules: [
        {
          id: 'row-module-1',
          containerId: 'module-1',
          versionId: 'module-version-1',
          title: 'Leksjon 1',
          titleEn: null,
          position: 0,
          isRequired: true,
          publishState: 'draft',
          sections: [{ id: 'sec-1', title: 'Nye ord', position: 0, items: [item('a'), item('b')] }],
          ungroupedItems: [item('c')],
        },
      ],
      items: [item('d', { position: 1 })],
    },
  ],
  ungroupedItems: [],
};

beforeEach(() => {
  vi.mocked(restoreContainerItemsAction)
    .mockReset()
    .mockResolvedValue({
      ok: true,
      value: undefined,
    } as never);
  vi.mocked(restoreSectionAction)
    .mockReset()
    .mockResolvedValue({
      ok: true,
      value: undefined,
    } as never);
});

describe('describeRemoval', () => {
  it('describes a block by the module that places it, and that module’s whole order', () => {
    expect(describeRemoval(TREE, 'course-1', 'a')).toEqual({
      containerId: 'module-1',
      row: { itemType: 'lesson', refId: 'ref-a', sectionId: 'sec-1', removedItemId: 'a' },
      orderedItemIds: ['a', 'b', 'c'],
    });
  });

  it('files an ungrouped block back into no section', () => {
    expect(describeRemoval(TREE, 'course-1', 'c')?.row.sectionId).toBeNull();
  });

  it('describes a module as what it is — a container row of the course', () => {
    expect(describeRemoval(TREE, 'course-1', 'row-module-1')).toEqual({
      containerId: 'course-1',
      row: {
        itemType: 'container',
        refId: 'module-1',
        sectionId: 'level-a1',
        removedItemId: 'row-module-1',
      },
      orderedItemIds: ['row-module-1', 'd'],
    });
  });

  it('describes the course’s own material against the course', () => {
    expect(describeRemoval(TREE, 'course-1', 'd')?.containerId).toBe('course-1');
  });

  it('has nothing to say about a row the tree does not hold', () => {
    expect(describeRemoval(TREE, 'course-1', 'gone')).toBeNull();
  });
});

describe('rowRemovalUndo', () => {
  it('restores each container in one request, with the order it had', async () => {
    const removals = [
      describeRemoval(TREE, 'course-1', 'a')!,
      describeRemoval(TREE, 'course-1', 'b')!,
      describeRemoval(TREE, 'course-1', 'd')!,
    ];

    expect(await rowRemovalUndo('Removed 3 blocks.', removals).revert()).toBe(true);

    expect(restoreContainerItemsAction).toHaveBeenCalledTimes(2);
    expect(restoreContainerItemsAction).toHaveBeenCalledWith(
      'module-1',
      [removals[0]!.row, removals[1]!.row],
      ['a', 'b', 'c'],
    );
    expect(restoreContainerItemsAction).toHaveBeenCalledWith(
      'course-1',
      [removals[2]!.row],
      ['row-module-1', 'd'],
    );
  });

  it('reports failure when a container refuses the restore', async () => {
    vi.mocked(restoreContainerItemsAction).mockResolvedValue({
      ok: false,
      error: { code: 'conflict' },
    } as never);

    const entry = rowRemovalUndo('Removed “a”.', [describeRemoval(TREE, 'course-1', 'a')!]);
    expect(await entry.revert()).toBe(false);
  });
});

describe('level removal', () => {
  it('takes back everything the level held — deleting it only unassigned them', () => {
    expect(describeLevelRemoval(TREE, TREE.levels[0]!)).toEqual({
      title: 'A1',
      position: 0,
      memberItemIds: ['row-module-1', 'd'],
      orderedSectionIds: ['level-a1'],
      deletedSectionId: 'level-a1',
    });
  });

  it('cannot describe the placeholder level, which has no row in the database', () => {
    expect(describeLevelRemoval(TREE, { ...TREE.levels[0]!, id: null })).toBeNull();
  });

  it('recreates the section and hands the restore its members', async () => {
    const removal = describeLevelRemoval(TREE, TREE.levels[0]!)!;

    expect(await levelRemovalUndo('Removed “A1”.', 'course-1', removal).revert()).toBe(true);

    expect(restoreSectionAction).toHaveBeenCalledWith(
      'course-1',
      'A1',
      0,
      ['row-module-1', 'd'],
      ['level-a1'],
      'level-a1',
    );
  });
});
