import { describe, expect, it } from 'vitest';

import type {
  CurriculumTree,
  CurriculumTreeItemNode,
  CurriculumTreeModuleNode,
} from '@/features/content/types';

import { canDuplicate, duplicateTargetFor } from './duplicate-target';

function item(
  id: string,
  title = id,
  itemType: CurriculumTreeItemNode['itemType'] = 'lesson',
): CurriculumTreeItemNode {
  return {
    id,
    itemType,
    refId: `ref-${id}`,
    title,
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

function module_(
  id: string,
  sectionItems: CurriculumTreeItemNode[],
  ungroupedItems: CurriculumTreeItemNode[] = [],
): CurriculumTreeModuleNode {
  return {
    id,
    containerId: `container-${id}`,
    versionId: `version-${id}`,
    title: id,
    titleEn: null,
    learningGoals: [],
    position: 0,
    isRequired: true,
    publishState: 'published',
    sections: [{ id: `section-${id}`, title: 'Nye ord', position: 0, items: sectionItems }],
    ungroupedItems,
  };
}

const TREE: CurriculumTree = {
  versionId: 'version-1',
  containerId: 'course-1',
  containerType: 'course',
  levelSystem: 'cefr',
  publishState: 'published',
  ungroupedItems: [item('loose')],
  levels: [
    {
      id: 'level-1',
      title: 'Leksjon 1',
      position: 0,
      items: [item('level-own')],
      modules: [
        module_('mod-1', [item('a')], [item('words', 'Nye ord', 'vocabulary_list')]),
        module_('mod-2', [item('c', 'Øvelse', 'exercise')]),
      ],
    },
  ],
};

describe('canDuplicate', () => {
  it('copies lessons, exercises and modules, never lists or rules', () => {
    expect(canDuplicate('lesson')).toBe(true);
    expect(canDuplicate('exercise')).toBe(true);
    expect(canDuplicate('container')).toBe(true);
    expect(canDuplicate('vocabulary_list')).toBe(false);
    expect(canDuplicate('grammar_rule')).toBe(false);
  });
});

describe('duplicateTargetFor', () => {
  it('copies a module from the course row that places it', () => {
    expect(duplicateTargetFor(TREE, 'course-1', 'mod-1')).toEqual({
      containerId: 'course-1',
      rowId: 'mod-1',
      itemType: 'container',
      title: 'mod-1',
      kind: 'module',
    });
  });

  it('copies a block from the module that holds it', () => {
    expect(duplicateTargetFor(TREE, 'course-1', 'c')).toEqual({
      containerId: 'container-mod-2',
      rowId: 'c',
      itemType: 'exercise',
      title: 'Øvelse',
      kind: 'item',
    });
  });

  it("copies the course's own material from the course", () => {
    expect(duplicateTargetFor(TREE, 'course-1', 'level-own')?.containerId).toBe('course-1');
  });

  it('has nothing to copy for a level, a vocabulary list or a content id', () => {
    expect(duplicateTargetFor(TREE, 'course-1', 'level-1')).toBeNull();
    expect(duplicateTargetFor(TREE, 'course-1', 'words')).toBeNull();
    // The lookup would find row `a` by its content id; the copy must be of an exact row.
    expect(duplicateTargetFor(TREE, 'course-1', 'ref-a')).toBeNull();
  });
});
