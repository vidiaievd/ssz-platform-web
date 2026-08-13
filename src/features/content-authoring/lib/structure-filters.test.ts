import { describe, expect, it } from 'vitest';

import type { CurriculumTreeItemNode } from '@/features/content/types';

import {
  EMPTY_FILTERS,
  blockState,
  isFiltering,
  materialGroup,
  matchesFilters,
  type StructureFilters,
} from './structure-filters';

function item(overrides: Partial<CurriculumTreeItemNode> = {}): CurriculumTreeItemNode {
  return {
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
    ...overrides,
  };
}

const filters = (over: Partial<StructureFilters> = {}): StructureFilters => ({
  ...EMPTY_FILTERS,
  ...over,
});

describe('isFiltering', () => {
  it('is false for the untouched toolbar', () => {
    expect(isFiltering(EMPTY_FILTERS)).toBe(false);
  });

  it('ignores a query of nothing but whitespace', () => {
    expect(isFiltering(filters({ query: '   ' }))).toBe(false);
  });

  it.each([{ query: 'bok' }, { type: 'vocab' as const }, { state: 'draft' as const }])(
    'is true for %o',
    (over) => {
      expect(isFiltering(filters(over))).toBe(true);
    },
  );
});

describe('materialGroup', () => {
  it('files reading, listening, video and live sessions under one family', () => {
    expect(materialGroup('text')).toBe('text');
    expect(materialGroup('audio')).toBe('text');
    expect(materialGroup('video')).toBe('text');
    expect(materialGroup('live')).toBe('text');
  });

  it('keeps vocabulary, grammar and exercises apart', () => {
    expect(materialGroup('vocab')).toBe('vocab');
    expect(materialGroup('grammar')).toBe('grammar');
    expect(materialGroup('exercise')).toBe('exercises');
  });
});

describe('blockState', () => {
  it('calls a row draft when its container has never been published', () => {
    expect(blockState(item({ isLive: null }))).toBe('draft');
  });

  it('calls a row edited while students cannot open it yet', () => {
    expect(blockState(item({ isLive: false }))).toBe('edited');
  });

  // A live row can still be waiting: it was reordered, or made optional, since
  // the last release.
  it('calls a live row edited when publishing would still change it', () => {
    expect(blockState(item({ isLive: true, pendingChange: 'moved' }))).toBe('edited');
  });

  it('calls a live row with nothing pending published', () => {
    expect(blockState(item())).toBe('published');
  });
});

describe('matchesFilters', () => {
  it('keeps everything when nothing is filtered', () => {
    expect(matchesFilters(item(), EMPTY_FILTERS, 'Reading')).toBe(true);
  });

  it('matches the title case-insensitively and on a fragment', () => {
    expect(matchesFilters(item(), filters({ query: 'ARBEIDS' }), 'Reading')).toBe(true);
    expect(matchesFilters(item(), filters({ query: 'jobbintervju' }), 'Reading')).toBe(false);
  });

  // Searching "exercise" should find exercises, whose titles rarely say so.
  it('matches the material-kind label as well as the title', () => {
    expect(matchesFilters(item(), filters({ query: 'reading' }), 'Reading')).toBe(true);
  });

  it('survives an untitled row instead of throwing on it', () => {
    expect(matchesFilters(item({ title: null }), filters({ query: 'x' }), 'Reading')).toBe(false);
  });

  it('filters by block-type family', () => {
    expect(matchesFilters(item({ lessonKind: 'audio' }), filters({ type: 'text' }), '')).toBe(true);
    expect(matchesFilters(item(), filters({ type: 'exercises' }), '')).toBe(false);
  });

  it('filters by state', () => {
    expect(matchesFilters(item({ isLive: null }), filters({ state: 'draft' }), '')).toBe(true);
    expect(matchesFilters(item(), filters({ state: 'draft' }), '')).toBe(false);
  });

  it('requires every active filter to pass, not just one', () => {
    const exercise = item({ itemType: 'exercise', lessonKind: null, title: 'Gap-fill' });
    expect(matchesFilters(exercise, filters({ type: 'exercises', state: 'draft' }), '')).toBe(false);
  });
});
