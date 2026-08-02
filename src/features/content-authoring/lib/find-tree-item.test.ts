import { describe, expect, it } from 'vitest';

import type { CurriculumTree } from '@/features/content/types';

import { findItemWithModule } from './find-tree-item';

const TREE: CurriculumTree = {
  versionId: 'course-version-1',
  containerId: 'course-1',
  publishState: 'draft',
  levelSystem: 'cefr',
  levels: [
    {
      id: 'level-a1',
      title: 'A1 — Beginner',
      position: 0,
      modules: [
        {
          id: 'item-module-1',
          containerId: 'module-1',
          versionId: 'module-version-1',
          title: 'Samfunn og kultur',
          titleEn: null,
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
                  durationMinutes: 6,
                  xpReward: 10,
                },
              ],
            },
          ],
          publishState: 'draft',
          ungroupedItems: [
            {
              id: 'item-2',
              itemType: 'grammar_rule',
              refId: 'grammar-1',
              title: 'Bestemt form',
              position: 1,
              isRequired: true,
              lessonKind: null,
              state: 'draft',
              durationMinutes: null,
              xpReward: null,
            },
          ],
        },
      ],
    },
  ],
};

describe('findItemWithModule', () => {
  it('finds a sectioned item and its enclosing module containerId', () => {
    const result = findItemWithModule(TREE, 'item-1');
    expect(result).not.toBeNull();
    expect(result?.item.title).toBe('En vanlig arbeidsdag');
    expect(result?.sectionTitle).toBe('Reinforce & read');
    expect(result?.moduleContainerId).toBe('module-1');
  });

  it('finds an ungrouped item and its enclosing module containerId', () => {
    const result = findItemWithModule(TREE, 'item-2');
    expect(result).not.toBeNull();
    expect(result?.item.title).toBe('Bestemt form');
    expect(result?.sectionTitle).toBeNull();
    expect(result?.moduleContainerId).toBe('module-1');
  });

  it('returns null for an unknown item id', () => {
    expect(findItemWithModule(TREE, 'nope')).toBeNull();
  });
});
