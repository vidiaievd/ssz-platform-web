import { describe, expect, it } from 'vitest';

import type {
  CurriculumTree,
  CurriculumTreeItemNode,
  CurriculumTreeModuleNode,
} from '@/features/content/types';

import { checkedBlocks, collectBlocks } from './block-selection';

function item(id: string, title = id): CurriculumTreeItemNode {
  return {
    id,
    itemType: 'lesson',
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
      modules: [module_('mod-1', [item('a')], [item('b')]), module_('mod-2', [item('c')])],
    },
  ],
};

describe('collectBlocks', () => {
  it('lists every block in drawing order', () => {
    expect(collectBlocks(TREE, 'course-1').map((b) => b.id)).toEqual([
      'a',
      'b',
      'c',
      'level-own',
      'loose',
    ]);
  });

  it('points a nested block at its own module, not at the course', () => {
    const blocks = collectBlocks(TREE, 'course-1');
    expect(blocks.find((b) => b.id === 'a')?.containerId).toBe('container-mod-1');
    expect(blocks.find((b) => b.id === 'b')?.containerId).toBe('container-mod-1');
    expect(blocks.find((b) => b.id === 'c')?.containerId).toBe('container-mod-2');
  });

  it('gives the edited container its own leaf material', () => {
    const blocks = collectBlocks(TREE, 'course-1');
    expect(blocks.find((b) => b.id === 'level-own')?.containerId).toBe('course-1');
    expect(blocks.find((b) => b.id === 'loose')?.containerId).toBe('course-1');
  });
});

describe('checkedBlocks', () => {
  it('resolves the checked ids in tree order', () => {
    const checked = new Set(['c', 'a']);
    expect(checkedBlocks(TREE, 'course-1', checked).map((b) => b.id)).toEqual(['a', 'c']);
  });

  it('drops ids the tree no longer holds, so a stale tick cannot act', () => {
    const checked = new Set(['a', 'deleted-elsewhere']);
    expect(checkedBlocks(TREE, 'course-1', checked).map((b) => b.id)).toEqual(['a']);
  });

  it('returns nothing when nothing is checked', () => {
    expect(checkedBlocks(TREE, 'course-1', new Set())).toEqual([]);
  });
});
