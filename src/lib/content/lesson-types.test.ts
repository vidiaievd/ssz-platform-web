import { describe, expect, it } from 'vitest';

import { getLessonTypeDefinition, LESSON_TYPE_REGISTRY, MATERIAL_KINDS } from './lesson-types';

describe('lesson type registry', () => {
  it('covers all 7 material kinds', () => {
    expect(MATERIAL_KINDS).toHaveLength(7);
    expect(new Set(MATERIAL_KINDS).size).toBe(7);
  });

  it.each(MATERIAL_KINDS)('defines icon, hueVar and labelKey for %s', (kind) => {
    const def = getLessonTypeDefinition(kind);
    expect(def.kind).toBe(kind);
    expect(def.icon).toBeTruthy();
    expect(def.hueVar).toBe(`--ssz-type-${kind}`);
    expect(def.labelKey).toBe(`materialType.${kind}`);
  });

  it('includes the live stub type', () => {
    expect(LESSON_TYPE_REGISTRY.live).toBeDefined();
    expect(LESSON_TYPE_REGISTRY.live.kind).toBe('live');
  });

  it('does not preassign editor/reader components ahead of their FE2/FE5 steps', () => {
    for (const kind of MATERIAL_KINDS) {
      expect(LESSON_TYPE_REGISTRY[kind].editorComponent).toBeUndefined();
      expect(LESSON_TYPE_REGISTRY[kind].readerComponent).toBeUndefined();
    }
  });
});
