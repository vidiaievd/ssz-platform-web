import { describe, expect, it } from 'vitest';

import type { CurriculumTree } from '@/features/content/types';

import { findItemWithModule } from './find-tree-item';

const TREE: CurriculumTree = {
  versionId: 'course-version-1',
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
                  isLive: true,
                  pendingChange: null,
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
              isLive: false,
              pendingChange: null,
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

  it('finds material attached to the edited container itself', () => {
    // How a module's own editor sees its lessons: no enclosing module node.
    const moduleTree: CurriculumTree = {
      ...TREE,
      containerId: 'module-1',
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
              itemType: 'lesson',
              refId: 'lesson-9',
              title: 'Bartek søker ny jobb',
              position: 0,
              isRequired: true,
              lessonKind: 'text',
              state: 'published',
              isLive: true,
              pendingChange: null,
              durationMinutes: 4,
              xpReward: null,
            },
          ],
        },
      ],
    };

    const result = findItemWithModule(moduleTree, 'own-item-1');

    expect(result?.item.title).toBe('Bartek søker ny jobb');
    expect(result?.sectionTitle).toBe('Nye ord');
    expect(result?.moduleContainerId).toBe('module-1');
  });

  it('falls back to the content id, which is what pre-flight deep links carry', () => {
    // `READ_NO_TITLE` names the lesson, not the container-item that places it,
    // so matching only on container-item id sent the author to a 404.
    const result = findItemWithModule(TREE, 'lesson-1');

    expect(result?.item.id).toBe('item-1');
    expect(result?.moduleContainerId).toBe('module-1');
  });

  it('prefers an exact container-item hit over a content-id match', () => {
    const result = findItemWithModule(TREE, 'item-1');
    expect(result?.item.id).toBe('item-1');
  });
});
