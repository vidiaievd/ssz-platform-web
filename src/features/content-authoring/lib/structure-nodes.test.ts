import { describe, expect, it } from 'vitest';

import type {
  ContainerPublishState,
  CurriculumTreeLevelNode,
} from '@/features/content/types';

import { moduleCode, rollUpLevelPublishState, stripLevelPrefix } from './structure-nodes';

function level(modules: ContainerPublishState[]): CurriculumTreeLevelNode {
  return {
    id: 'level-1',
    title: 'Leksjon 1',
    position: 0,
    items: [],
    modules: modules.map((publishState, i) => ({
      id: `item-${i}`,
      containerId: `module-${i}`,
      versionId: `version-${i}`,
      title: `Module ${i}`,
      titleEn: null,
      position: i,
      isRequired: true,
      publishState,
      sections: [],
      ungroupedItems: [],
    })),
  };
}

describe('moduleCode', () => {
  it('numbers the level and letters the module within it', () => {
    expect(moduleCode(0, 0)).toBe('1A');
    expect(moduleCode(0, 2)).toBe('1C');
    expect(moduleCode(3, 1)).toBe('4B');
  });

  it('falls back to a number past the 26th module rather than inventing "1AA"', () => {
    expect(moduleCode(0, 25)).toBe('1Z');
    expect(moduleCode(0, 26)).toBe('127');
  });
});

describe('rollUpLevelPublishState', () => {
  it('badges nothing when every module under the level is live', () => {
    expect(rollUpLevelPublishState(level(['published', 'published']))).toBeNull();
    expect(rollUpLevelPublishState(level([]))).toBeNull();
  });

  it('reports pending changes ahead of never-published, as the more urgent of the two', () => {
    expect(rollUpLevelPublishState(level(['draft', 'pending_changes']))).toBe('pending_changes');
  });

  it('reports a draft when nothing under the level has ever been published', () => {
    expect(rollUpLevelPublishState(level(['published', 'draft']))).toBe('draft');
  });
});

describe('stripLevelPrefix', () => {
  it('drops the numbered prefix an author typed into the title', () => {
    expect(stripLevelPrefix('Leksjon 1 — Arbeidsliv')).toBe('Arbeidsliv');
  });

  it.each([
    ['Level 2 - Utdanning', 'Utdanning'],
    ['Unit 3: Bolig og økonomi', 'Bolig og økonomi'],
    ['Урок 4. Здоровье', 'Здоровье'],
    ['Leksjon 10 – Helse', 'Helse'],
  ])('handles %s', (input, expected) => {
    expect(stripLevelPrefix(input)).toBe(expected);
  });

  it('keeps a title that has no such prefix', () => {
    expect(stripLevelPrefix('A1 — Beginner')).toBe('A1 — Beginner');
  });

  it('keeps the whole title when stripping would leave nothing to show', () => {
    expect(stripLevelPrefix('Leksjon 1')).toBe('Leksjon 1');
    expect(stripLevelPrefix('Leksjon 1 — ')).toBe('Leksjon 1 — ');
  });

  it('renders an untitled level as an empty label rather than "null"', () => {
    expect(stripLevelPrefix(null)).toBe('');
  });
});
