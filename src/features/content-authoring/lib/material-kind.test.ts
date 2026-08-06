import { describe, expect, it } from 'vitest';

import type { CurriculumTreeItemNode } from '@/features/content/types';

import { getMaterialKind } from './material-kind';

function item(overrides: Partial<CurriculumTreeItemNode>): CurriculumTreeItemNode {
  return {
    id: 'item-1',
    itemType: 'lesson',
    refId: 'ref-1',
    title: 'Title',
    position: 0,
    isRequired: true,
    lessonKind: null,
    state: null,
    isLive: null,
    pendingChange: null,
    durationMinutes: null,
    xpReward: null,
    ...overrides,
  };
}

describe('getMaterialKind', () => {
  it('maps vocabulary_list to vocab', () => {
    expect(getMaterialKind(item({ itemType: 'vocabulary_list' }))).toBe('vocab');
  });

  it('maps grammar_rule to grammar', () => {
    expect(getMaterialKind(item({ itemType: 'grammar_rule' }))).toBe('grammar');
  });

  it('maps exercise to exercise', () => {
    expect(getMaterialKind(item({ itemType: 'exercise' }))).toBe('exercise');
  });

  it.each(['text', 'video', 'audio', 'live'] as const)(
    'maps lesson with lessonKind %s through',
    (kind) => {
      expect(getMaterialKind(item({ itemType: 'lesson', lessonKind: kind }))).toBe(kind);
    },
  );

  it('falls back to text when a lesson has no lessonKind', () => {
    expect(getMaterialKind(item({ itemType: 'lesson', lessonKind: null }))).toBe('text');
  });
});
