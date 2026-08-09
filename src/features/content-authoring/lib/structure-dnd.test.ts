import { describe, expect, it } from 'vitest';

import type { CurriculumTreeItemNode, CurriculumTreeModuleNode } from '@/features/content/types';

import {
  blockFlatIndex,
  dropLineSide,
  planBlockDrop,
  type BlockDragData,
} from './structure-dnd';

function item(id: string): CurriculumTreeItemNode {
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
  };
}

/** Two sections (a b c | d) plus one ungrouped block (e). */
const MODULE: CurriculumTreeModuleNode = {
  id: 'item-module-1',
  containerId: 'module-1',
  versionId: 'version-1',
  title: 'Leksjon 1A',
  titleEn: null,
  position: 0,
  isRequired: true,
  publishState: 'published',
  sections: [
    { id: 'sec-1', title: 'Nye ord', position: 0, items: [item('a'), item('b'), item('c')] },
    { id: 'sec-2', title: 'Øvelser', position: 1, items: [item('d')] },
  ],
  ungroupedItems: [item('e')],
};

function drag(itemId: string, sectionId: string | null): BlockDragData {
  return {
    type: 'block',
    itemId,
    moduleContainerId: 'module-1',
    sectionId,
    flatIndex: blockFlatIndex(MODULE, itemId),
  };
}

function overBlock(itemId: string, sectionId: string | null, moduleContainerId = 'module-1') {
  return {
    type: 'block' as const,
    itemId,
    moduleContainerId,
    sectionId,
    flatIndex: blockFlatIndex(MODULE, itemId),
  };
}

describe('blockFlatIndex', () => {
  it('counts across sections and the ungrouped bucket', () => {
    expect(blockFlatIndex(MODULE, 'a')).toBe(0);
    expect(blockFlatIndex(MODULE, 'd')).toBe(3);
    expect(blockFlatIndex(MODULE, 'e')).toBe(4);
  });
});

describe('planBlockDrop', () => {
  it('lands a block dragged downwards past the row it was dropped on', () => {
    const plan = planBlockDrop(MODULE, drag('a', 'sec-1'), overBlock('c', 'sec-1'));
    expect(plan).toEqual({ kind: 'reorder', orderedItemIds: ['b', 'c', 'a', 'd', 'e'] });
  });

  it('lands a block dragged upwards in front of it', () => {
    const plan = planBlockDrop(MODULE, drag('c', 'sec-1'), overBlock('a', 'sec-1'));
    expect(plan).toEqual({ kind: 'reorder', orderedItemIds: ['c', 'a', 'b', 'd', 'e'] });
  });

  it('re-files a block dropped on a row of another section', () => {
    const plan = planBlockDrop(MODULE, drag('a', 'sec-1'), overBlock('d', 'sec-2'));
    expect(plan).toEqual({
      kind: 'move',
      sectionId: 'sec-2',
      orderedItemIds: ['b', 'c', 'd', 'a', 'e'],
    });
  });

  it('appends to the end of a section dropped on directly', () => {
    const plan = planBlockDrop(MODULE, drag('e', null), {
      type: 'section',
      moduleContainerId: 'module-1',
      sectionId: 'sec-1',
    });
    expect(plan).toEqual({
      kind: 'move',
      sectionId: 'sec-1',
      orderedItemIds: ['a', 'b', 'c', 'e', 'd'],
    });
  });

  it('places the first block of an empty section', () => {
    const emptied: CurriculumTreeModuleNode = {
      ...MODULE,
      sections: [
        MODULE.sections[0]!,
        { id: 'sec-2', title: 'Øvelser', position: 1, items: [] },
      ],
      ungroupedItems: [],
    };
    const plan = planBlockDrop(
      emptied,
      { ...drag('a', 'sec-1'), flatIndex: 0 },
      { type: 'section', moduleContainerId: 'module-1', sectionId: 'sec-2' },
    );
    expect(plan).toEqual({ kind: 'move', sectionId: 'sec-2', orderedItemIds: ['b', 'c', 'a'] });
  });

  it('refuses a block from another module, and says which case it is', () => {
    const fromElsewhere: BlockDragData = { ...drag('a', 'sec-1'), moduleContainerId: 'module-9' };
    expect(planBlockDrop(MODULE, fromElsewhere, overBlock('c', 'sec-1'))).toEqual({
      kind: 'cross-module',
    });
  });

  it('does nothing when a block is dropped on itself or on empty space', () => {
    expect(planBlockDrop(MODULE, drag('a', 'sec-1'), overBlock('a', 'sec-1'))).toEqual({
      kind: 'none',
    });
    expect(planBlockDrop(MODULE, drag('a', 'sec-1'), null)).toEqual({ kind: 'none' });
  });
});

describe('dropLineSide', () => {
  it('draws below the target when the block is coming down onto it', () => {
    expect(dropLineSide(drag('a', 'sec-1'), 2, 'module-1')).toBe('after');
  });

  it('draws above the target when the block is coming up onto it', () => {
    expect(dropLineSide(drag('c', 'sec-1'), 0, 'module-1')).toBe('before');
  });

  it('draws nothing over a module the block cannot land in', () => {
    expect(dropLineSide(drag('a', 'sec-1'), 0, 'module-2')).toBeNull();
  });
});
