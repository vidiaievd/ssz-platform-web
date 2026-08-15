import { describe, expect, it } from 'vitest';

import type { CurriculumTree, CurriculumTreeItemNode } from '@/features/content/types';

import { collectCourseExercises } from './collect-course-exercises';

function item(overrides: Partial<CurriculumTreeItemNode>): CurriculumTreeItemNode {
  return {
    id: 'row-1',
    itemType: 'exercise',
    refId: 'ex-1',
    title: 'Oversett',
    position: 1,
    isRequired: true,
    lessonKind: null,
    state: 'draft',
    isLive: null,
    pendingChange: null,
    durationMinutes: null,
    xpReward: null,
    ...overrides,
  };
}

function tree(overrides: Partial<CurriculumTree> = {}): CurriculumTree {
  return {
    versionId: 'v1',
    containerId: 'course-1',
    containerType: 'course',
    levelSystem: 'cefr',
    publishState: 'draft',
    levels: [],
    ungroupedItems: [],
    ...overrides,
  } as CurriculumTree;
}

const LEVEL = {
  id: 'lvl-1',
  title: 'B1',
  position: 1,
  modules: [
    {
      id: 'mod-1',
      containerId: 'module-1',
      versionId: 'mv1',
      title: 'Leksjon 3',
      titleEn: null,
      position: 1,
      isRequired: true,
      publishState: 'draft' as const,
      sections: [
        {
          id: 'sec-1',
          title: 'Tekst A',
          position: 1,
          items: [item({ id: 'row-1', refId: 'ex-1' })],
        },
      ],
      ungroupedItems: [item({ id: 'row-2', refId: 'ex-2', title: 'Rett feilene' })],
    },
  ],
  items: [],
};

describe('collectCourseExercises', () => {
  it('finds exercises wherever the tree keeps them', () => {
    const found = collectCourseExercises(
      tree({
        levels: [LEVEL],
        ungroupedItems: [item({ id: 'row-3', refId: 'ex-3', title: 'Løs' })],
      }) as CurriculumTree,
    );

    expect(found.map((e) => e.exerciseId)).toEqual(['ex-1', 'ex-2', 'ex-3']);
    // The row is what the editor and per-exercise queue URLs are built from; the
    // titles around it are what names the group on screen.
    expect(found[0]).toMatchObject({
      itemId: 'row-1',
      title: 'Oversett',
      levelTitle: 'B1',
      moduleTitle: 'Leksjon 3',
      sectionTitle: 'Tekst A',
    });
    expect(found[1]).toMatchObject({ moduleTitle: 'Leksjon 3', sectionTitle: null });
  });

  it('leaves everything that is not an exercise alone', () => {
    const found = collectCourseExercises(
      tree({
        ungroupedItems: [
          item({ id: 'row-4', refId: 'les-1', itemType: 'lesson', lessonKind: 'text' }),
          item({ id: 'row-5', refId: 'voc-1', itemType: 'vocabulary_list' }),
          item({ id: 'row-6', refId: 'ex-9' }),
        ],
      }),
    );

    expect(found.map((e) => e.exerciseId)).toEqual(['ex-9']);
  });

  it('counts an exercise placed twice once', () => {
    const found = collectCourseExercises(
      tree({
        ungroupedItems: [
          item({ id: 'row-7', refId: 'ex-1' }),
          item({ id: 'row-8', refId: 'ex-1' }),
        ],
      }),
    );

    // A second entry would double every submission of that exercise on the screen.
    expect(found).toHaveLength(1);
    expect(found[0]!.itemId).toBe('row-7');
  });
});
