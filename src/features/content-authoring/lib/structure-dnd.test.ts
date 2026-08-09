import { describe, expect, it } from 'vitest';

import type {
  CurriculumTree,
  CurriculumTreeItemNode,
  CurriculumTreeModuleNode,
} from '@/features/content/types';

import {
  applyBlockPreview,
  applyCourseEntryPreview,
  flattenCourseEntries,
  planBlockDrop,
  planCourseEntryDrop,
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

/** A course: two levels, three modules, and one piece of material on the course itself. */
const COURSE: CurriculumTree = {
  versionId: 'course-version-1',
  containerId: 'course-1',
  containerType: 'course',
  levelSystem: 'cefr',
  publishState: 'draft',
  ungroupedItems: [],
  levels: [
    {
      id: 'level-1',
      title: 'Leksjon 1',
      position: 0,
      items: [{ ...item('intro'), position: 2 }],
      modules: [
        { ...MODULE, id: 'mod-a', containerId: 'container-a', position: 0 },
        { ...MODULE, id: 'mod-b', containerId: 'container-b', position: 1 },
      ],
    },
    {
      id: 'level-2',
      title: 'Leksjon 2',
      position: 1,
      items: [],
      modules: [{ ...MODULE, id: 'mod-c', containerId: 'container-c', position: 0 }],
    },
  ],
};

const courseDrag = (itemId: string) => ({ type: 'courseEntry' as const, itemId });

describe('flattenCourseEntries', () => {
  it('covers modules and the course’s own material in one ordered list', () => {
    // The reorder endpoint rejects a partial order, and the old module reorder
    // sent exactly that: modules only.
    expect(flattenCourseEntries(COURSE)).toEqual([
      { id: 'mod-a', sectionId: 'level-1' },
      { id: 'mod-b', sectionId: 'level-1' },
      { id: 'intro', sectionId: 'level-1' },
      { id: 'mod-c', sectionId: 'level-2' },
    ]);
  });
});

describe('planCourseEntryDrop', () => {
  it('reorders modules inside their level', () => {
    expect(planCourseEntryDrop(COURSE, courseDrag('mod-a'), courseDrag('mod-b'))).toEqual({
      kind: 'reorder',
      orderedItemIds: ['mod-b', 'mod-a', 'intro', 'mod-c'],
    });
  });

  it('moves a module onto another level by dropping it on a module there', () => {
    expect(planCourseEntryDrop(COURSE, courseDrag('mod-a'), courseDrag('mod-c'))).toEqual({
      kind: 'move',
      sectionId: 'level-2',
      orderedItemIds: ['mod-b', 'intro', 'mod-c', 'mod-a'],
    });
  });

  it('files a module at the end of a level dropped on directly', () => {
    expect(
      planCourseEntryDrop(COURSE, courseDrag('mod-c'), { type: 'level', levelId: 'level-1' }),
    ).toEqual({
      kind: 'move',
      sectionId: 'level-1',
      orderedItemIds: ['mod-a', 'mod-b', 'intro', 'mod-c'],
    });
  });

  it('ignores a drop on something that is not a course row', () => {
    expect(
      planCourseEntryDrop(COURSE, courseDrag('mod-a'), {
        type: 'section',
        moduleContainerId: 'container-a',
        sectionId: 'sec-1',
      }),
    ).toEqual({ kind: 'none' });
  });
});

describe('applyCourseEntryPreview', () => {
  it('draws the module in the level it is heading for', () => {
    const plan = planCourseEntryDrop(COURSE, courseDrag('mod-a'), courseDrag('mod-c'));
    const preview = applyCourseEntryPreview(COURSE, 'mod-a', plan);

    expect(preview.levels[0]!.modules.map((m) => m.id)).toEqual(['mod-b']);
    expect(preview.levels[1]!.modules.map((m) => m.id)).toEqual(['mod-c', 'mod-a']);
  });

  it('reorders within a level without moving anything between them', () => {
    const plan = planCourseEntryDrop(COURSE, courseDrag('mod-a'), courseDrag('mod-b'));
    const preview = applyCourseEntryPreview(COURSE, 'mod-a', plan);

    expect(preview.levels[0]!.modules.map((m) => m.id)).toEqual(['mod-b', 'mod-a']);
    expect(preview.levels[1]!.modules.map((m) => m.id)).toEqual(['mod-c']);
  });

  it("carries the course's own material between levels too", () => {
    const plan = planCourseEntryDrop(COURSE, courseDrag('intro'), {
      type: 'level',
      levelId: 'level-2',
    });
    const preview = applyCourseEntryPreview(COURSE, 'intro', plan);

    expect(preview.levels[0]!.items).toEqual([]);
    expect(preview.levels[1]!.items.map((i) => i.id)).toEqual(['intro']);
  });
});
