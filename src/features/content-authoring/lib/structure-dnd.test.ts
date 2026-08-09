import { describe, expect, it } from 'vitest';

import type { CurriculumTreeItemNode, CurriculumTreeModuleNode } from '@/features/content/types';

import { applyBlockPreview, planBlockDrop, type BlockDragData } from './structure-dnd';

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

function drag(itemId: string): BlockDragData {
  return { type: 'block', itemId, moduleContainerId: 'module-1' };
}

function overBlock(itemId: string, moduleContainerId = 'module-1') {
  return { type: 'block' as const, itemId, moduleContainerId };
}

describe('planBlockDrop', () => {
  it('lands a block dragged downwards past the row it was dropped on', () => {
    const plan = planBlockDrop(MODULE, drag('a'), overBlock('c'));
    expect(plan).toEqual({ kind: 'reorder', orderedItemIds: ['b', 'c', 'a', 'd', 'e'] });
  });

  it('lands a block dragged upwards in front of it', () => {
    const plan = planBlockDrop(MODULE, drag('c'), overBlock('a'));
    expect(plan).toEqual({ kind: 'reorder', orderedItemIds: ['c', 'a', 'b', 'd', 'e'] });
  });

  it('re-files a block dropped on a row of another section', () => {
    const plan = planBlockDrop(MODULE, drag('a'), overBlock('d'));
    expect(plan).toEqual({
      kind: 'move',
      sectionId: 'sec-2',
      orderedItemIds: ['b', 'c', 'd', 'a', 'e'],
    });
  });

  it('appends to the end of a section dropped on directly', () => {
    const plan = planBlockDrop(MODULE, drag('e'), {
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
    const plan = planBlockDrop(emptied, drag('a'), {
      type: 'section',
      moduleContainerId: 'module-1',
      sectionId: 'sec-2',
    });
    expect(plan).toEqual({ kind: 'move', sectionId: 'sec-2', orderedItemIds: ['b', 'c', 'a'] });
  });

  it('refuses a block from another module, and says which case it is', () => {
    const fromElsewhere: BlockDragData = { ...drag('a'), moduleContainerId: 'module-9' };
    expect(planBlockDrop(MODULE, fromElsewhere, overBlock('c'))).toEqual({
      kind: 'cross-module',
    });
  });

  it('does nothing when a block is dropped on itself or on empty space', () => {
    expect(planBlockDrop(MODULE, drag('a'), overBlock('a'))).toEqual({
      kind: 'none',
    });
    expect(planBlockDrop(MODULE, drag('a'), null)).toEqual({ kind: 'none' });
  });
});

describe('applyBlockPreview', () => {
  it('shows the block already sitting where it would land', () => {
    const plan = planBlockDrop(MODULE, drag('a'), overBlock('c'));
    const preview = applyBlockPreview(MODULE, 'a', plan);

    expect(preview.sections[0]!.items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(preview.sections[1]!.items.map((i) => i.id)).toEqual(['d']);
    expect(preview.ungroupedItems.map((i) => i.id)).toEqual(['e']);
  });

  it('moves the block into the other section it is being dropped on', () => {
    const plan = planBlockDrop(MODULE, drag('a'), overBlock('d'));
    const preview = applyBlockPreview(MODULE, 'a', plan);

    expect(preview.sections[0]!.items.map((i) => i.id)).toEqual(['b', 'c']);
    expect(preview.sections[1]!.items.map((i) => i.id)).toEqual(['d', 'a']);
  });

  it('takes a block out of the ungrouped bucket when it is filed into a section', () => {
    const plan = planBlockDrop(MODULE, drag('e'), {
      type: 'section',
      moduleContainerId: 'module-1',
      sectionId: 'sec-1',
    });
    const preview = applyBlockPreview(MODULE, 'e', plan);

    expect(preview.sections[0]!.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'e']);
    expect(preview.ungroupedItems).toEqual([]);
  });

  it('leaves the module untouched when the drop would do nothing', () => {
    expect(applyBlockPreview(MODULE, 'a', { kind: 'none' })).toBe(MODULE);
    expect(applyBlockPreview(MODULE, 'a', { kind: 'cross-module' })).toBe(MODULE);
  });
});
