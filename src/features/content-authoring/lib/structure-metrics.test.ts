import { describe, expect, it } from 'vitest';

import type {
  CurriculumTree,
  CurriculumTreeItemNode,
  CurriculumTreeModuleNode,
} from '@/features/content/types';

import { computeStructureMetrics } from './structure-metrics';

function item(
  id: string,
  overrides: Partial<CurriculumTreeItemNode> = {},
): CurriculumTreeItemNode {
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
  ungroupedItems: [item('loose', { durationMinutes: 3 })],
  levels: [
    {
      id: 'level-1',
      title: 'Leksjon 1',
      position: 0,
      items: [item('level-own', { durationMinutes: 2 })],
      modules: [
        module_(
          'mod-1',
          [
            item('vocab-1', { itemType: 'vocabulary_list', lessonKind: null, durationMinutes: 4 }),
            item('ex-1', { itemType: 'exercise', lessonKind: null, durationMinutes: 1 }),
          ],
          [item('ex-2', { itemType: 'exercise', lessonKind: null, durationMinutes: 1 })],
        ),
        module_('mod-2', [item('text-1', { durationMinutes: null })]),
      ],
    },
    { id: 'level-2', title: 'Leksjon 2', position: 1, items: [], modules: [] },
  ],
};

describe('computeStructureMetrics', () => {
  it('counts levels and the modules nested under them', () => {
    const metrics = computeStructureMetrics(TREE);
    expect(metrics.levels).toBe(2);
    expect(metrics.modules).toBe(2);
  });

  it('counts leaf items from sections, module buckets, levels and the root bucket alike', () => {
    // vocab-1, ex-1, ex-2, text-1, level-own, loose
    expect(computeStructureMetrics(TREE).lessons).toBe(6);
  });

  it('counts exercises as the subset of leaves whose material kind is exercise', () => {
    expect(computeStructureMetrics(TREE).exercises).toBe(2);
  });

  it('sums durations and treats a missing one as zero rather than skipping the item', () => {
    // 4 + 1 + 1 + 0 + 2 + 3
    expect(computeStructureMetrics(TREE).estimatedMinutes).toBe(11);
  });

  it('reports zeroes while the tree is still loading', () => {
    expect(computeStructureMetrics(undefined)).toEqual({
      levels: 0,
      modules: 0,
      lessons: 0,
      exercises: 0,
      estimatedMinutes: 0,
    });
  });
});
