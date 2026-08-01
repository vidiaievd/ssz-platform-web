import { describe, expect, it } from 'vitest';

import type {
  CurriculumTree,
  CurriculumTreeItemNode,
  CurriculumTreeModuleNode,
} from '@/features/content/types';

import { collectLevelGrammarRules } from './level-grammar-rules';

function item(
  id: string,
  itemType: CurriculumTreeItemNode['itemType'],
  refId: string,
  title: string,
): CurriculumTreeItemNode {
  return {
    id,
    itemType,
    refId,
    title,
    position: 0,
    isRequired: true,
    lessonKind: itemType === 'lesson' ? 'text' : null,
    state: 'published',
    durationMinutes: null,
    xpReward: null,
  };
}

function moduleNode(
  containerId: string,
  title: string,
  items: CurriculumTreeItemNode[],
): CurriculumTreeModuleNode {
  return {
    id: `mi-${containerId}`,
    containerId,
    versionId: 'v1',
    title,
    titleEn: null,
    position: 0,
    isRequired: true,
    sections: [{ id: `s-${containerId}`, title: 'Innhold', position: 0, items }],
    ungroupedItems: [],
  };
}

/** The shape a course actually has: text sub-lessons plus one grammar module per Leksjon. */
const TREE: CurriculumTree = {
  versionId: 'v1',
  containerId: 'course-1',
  levelSystem: 'cefr',
  levels: [
    {
      id: 'lvl-1',
      title: 'Leksjon 1 — Arbeidsliv',
      position: 0,
      modules: [
        moduleNode('mod-1a', '1A — Bartek søker ny jobb', [item('i1', 'lesson', 'lesson-1a', '1A')]),
        moduleNode('mod-1g', '1 — Grammatikk og øvelser', [
          item('i2', 'grammar_rule', 'rule-indirekte', 'Indirekte tale'),
          item('i3', 'exercise', 'ex-1', 'Øvelse 1'),
        ]),
      ],
    },
    {
      id: 'lvl-2',
      title: 'Leksjon 2 — Utdanning',
      position: 1,
      modules: [
        moduleNode('mod-2g', '2 — Grammatikk og øvelser', [
          item('i4', 'grammar_rule', 'rule-modale', 'Modale verb'),
        ]),
      ],
    },
  ],
};

describe('collectLevelGrammarRules', () => {
  it('offers the rule that lives in a sibling module of the same Leksjon', () => {
    expect(collectLevelGrammarRules(TREE, 'mod-1a')).toEqual([
      { id: 'rule-indirekte', title: 'Indirekte tale', moduleTitle: '1 — Grammatikk og øvelser' },
    ]);
  });

  it('leaves out the rules of other Leksjoner', () => {
    const titles = collectLevelGrammarRules(TREE, 'mod-1a').map((r) => r.title);
    expect(titles).not.toContain('Modale verb');
  });

  it('ignores everything that is not a grammar rule', () => {
    expect(collectLevelGrammarRules(TREE, 'mod-1g').map((r) => r.id)).toEqual(['rule-indirekte']);
  });

  it('lists a rule once even when two modules of the Leksjon carry it', () => {
    const duplicated: CurriculumTree = {
      ...TREE,
      levels: [
        {
          ...TREE.levels[0]!,
          modules: [
            ...TREE.levels[0]!.modules,
            moduleNode('mod-1b', '1B — Jobbintervjuet', [
              item('i5', 'grammar_rule', 'rule-indirekte', 'Indirekte tale'),
            ]),
          ],
        },
      ],
    };

    expect(collectLevelGrammarRules(duplicated, 'mod-1b')).toHaveLength(1);
  });

  it('returns nothing for a module that is not in the tree', () => {
    expect(collectLevelGrammarRules(TREE, 'mod-unknown')).toEqual([]);
  });
});
