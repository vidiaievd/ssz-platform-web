import { describe, expect, it } from 'vitest';

import type { AtomCoverage, ContainerCoverage } from '../types';

import { buildTriage, recipeIssuesByModule } from './coverage-triage';
import { filtersFromParams } from './structure-filters';

const label = (skill: string) => skill;

function coverage(issues: ContainerCoverage['draft'] extends null ? never : unknown[]) {
  return {
    draft: { available: true, issues, coverage: {} },
  } as unknown as ContainerCoverage;
}

function atoms(issues: unknown[]) {
  return { available: true, issues } as unknown as AtomCoverage;
}

describe('buildTriage', () => {
  // Nine true things at once is nine things nobody acts on; the loud ones
  // come first and the rest keep the services' own order.
  it('puts the findings worth acting on first', () => {
    const { rows } = buildTriage(
      coverage([
        { code: 'COV_MOSTLY_BANK', level: 'info', bank: 34, total: 40 },
        { code: 'COV_SKILL_ABSENT', level: 'warning', skill: 'listening' },
      ]),
      atoms([{ code: 'atom_untested', severity: 'warning', count: 26 }]),
      label,
    );

    expect(rows.map((r) => r.code)).toEqual([
      'COV_SKILL_ABSENT',
      'atom_untested',
      'COV_MOSTLY_BANK',
    ]);
    expect(rows[0]?.severity).toBe('high');
    expect(rows[2]?.severity).toBe('low');
  });

  // An exercise nobody classified is a gap in what the report can see, not a
  // gap in the course — sending an author hunting for it would be a lie.
  it('keeps findings about the record out of the task list', () => {
    const { rows, notes } = buildTriage(
      coverage([
        { code: 'COV_UNCLASSIFIED', level: 'warning', count: 3 },
        { code: 'COV_FOCUS_UNKNOWN', level: 'info', unknown: 12, total: 40 },
      ]),
      atoms([{ code: 'atom_unknown_modality', severity: 'note', count: 4 }]),
      label,
    );

    expect(rows).toEqual([]);
    expect(notes.map((n) => n.code)).toEqual([
      'COV_UNCLASSIFIED',
      'COV_FOCUS_UNKNOWN',
      'atom_unknown_modality',
    ]);
  });

  it('sends each finding to the material it is about', () => {
    const { rows } = buildTriage(
      coverage([]),
      atoms([
        { code: 'rule_without_atoms', severity: 'warning', count: 2 },
        { code: 'atom_untested', severity: 'warning', count: 26 },
      ]),
      label,
    );

    expect(rows.find((r) => r.code === 'rule_without_atoms')?.target).toEqual({ type: 'grammar' });
    expect(rows.find((r) => r.code === 'atom_untested')?.target).toEqual({ type: 'exercises' });
  });

  // A remark the services learn before this client learns its sentence should
  // be invisible, never fatal.
  it('drops a code it has no sentence for', () => {
    const { rows, notes } = buildTriage(
      coverage([{ code: 'COV_SOMETHING_NEW', level: 'warning' }]),
      atoms([{ code: 'atom_something_new', severity: 'warning', count: 1 }]),
      label,
    );

    expect(rows).toEqual([]);
    expect(notes).toEqual([]);
  });

  it('says nothing at all before the reports arrive', () => {
    expect(buildTriage(undefined, undefined, label)).toEqual({ rows: [], notes: [] });
  });
});

describe('filtersFromParams', () => {
  it('reads the filters a triage button asks for', () => {
    expect(filtersFromParams(new URLSearchParams('view=coverage&type=exercises'))).toEqual({
      query: '',
      type: 'exercises',
      state: 'all',
    });
    expect(filtersFromParams(new URLSearchParams('type=grammar&state=draft'))).toEqual({
      query: '',
      type: 'grammar',
      state: 'draft',
    });
  });

  // A stale link should open the tree, not an error, and never leave a filter
  // the toolbar cannot clear.
  it('ignores what the toolbar cannot express', () => {
    expect(filtersFromParams(new URLSearchParams('type=listening'))).toBeUndefined();
    expect(filtersFromParams(new URLSearchParams(''))).toBeUndefined();
  });
});

describe('the lesson recipe in the triage', () => {
  const audio = { axis: 'input', values: ['audio', 'video'], min: 1 } as const;
  const picked = { axis: 'modality', values: ['recognition'], maxShare: 0.6 } as const;

  const below = (total: number) => ({
    code: 'RECIPE_BELOW_MIN',
    level: 'warning',
    ruleIndex: 1,
    rule: audio,
    count: 0,
    min: 1,
    total,
  });
  const above = {
    code: 'RECIPE_ABOVE_SHARE',
    level: 'warning',
    ruleIndex: 2,
    rule: picked,
    count: 4,
    maxShare: 0.6,
    total: 6,
  };

  const report = {
    draft: {
      available: true,
      issues: [],
      coverage: {},
      modules: [
        { containerId: 'm1', coverage: { total: 6 }, issues: [], recipeIssues: [below(6), above] },
        { containerId: 'm2', coverage: { total: 3 }, issues: [], recipeIssues: [below(3)] },
        { containerId: 'm3', coverage: { total: 5 }, issues: [], recipeIssues: [] },
        // Empty: the service does not judge it, and it must not swell the denominator.
        { containerId: 'm4', coverage: { total: 0 }, issues: [], recipeIssues: [] },
      ],
    },
  } as unknown as ContainerCoverage;

  // Fifty lessons that all lack listening are one thing to do, not fifty rows.
  it('folds the lessons into one row per failed rule', () => {
    const recipe = buildTriage(report, undefined, label).rows.filter((r) => r.source === 'recipe');

    expect(recipe.map((r) => [r.code, r.values])).toEqual([
      ['RECIPE_BELOW_MIN', { lessons: 2, total: 3 }],
      ['RECIPE_ABOVE_SHARE', { lessons: 1, total: 3 }],
    ]);
    expect(recipe[0]?.rule).toEqual(audio);
  });

  it('calls a missing kind of practice loud and an exceeded balance quiet', () => {
    const recipe = buildTriage(report, undefined, label).rows.filter((r) => r.source === 'recipe');

    expect(recipe.map((r) => r.severity)).toEqual(['high', 'low']);
  });

  it('keys the dots by the lesson they belong to, and draws none where nothing is missing', () => {
    const byModule = recipeIssuesByModule(report);

    expect([...byModule.keys()]).toEqual(['m1', 'm2']);
    expect(byModule.get('m1')).toHaveLength(2);
  });

  // A service older than phase 10 sends no recipe remarks; that is "nothing to say".
  it('reads a report without recipe remarks as nothing to say', () => {
    expect(buildTriage(coverage([]), undefined, label).rows).toEqual([]);
    expect(recipeIssuesByModule(undefined).size).toBe(0);
  });
});

describe('atom findings named one per atom', () => {
  // The service names `atom_untested` once per word, with no count. One row per word
  // read "0 facts this teaches and never tests" 366 times over.
  it('folds them into one row that counts them', () => {
    const { rows } = buildTriage(
      undefined,
      atoms([
        { code: 'atom_untested', severity: 'warning', atomId: 'a', title: '1. juledag' },
        { code: 'atom_untested', severity: 'warning', atomId: 'b', title: '2. påskedag' },
        { code: 'atom_untested', severity: 'warning', atomId: 'c', title: 'advent' },
        { code: 'scope_no_production', severity: 'warning', count: 0 },
      ]),
      label,
    );

    expect(rows.map((r) => [r.code, r.values.count])).toEqual([
      ['atom_untested', 3],
      ['scope_no_production', 0],
    ]);
  });

  it('gives each modality of a one-way finding its own sentence', () => {
    const { rows } = buildTriage(
      undefined,
      atoms([
        { code: 'atom_single_modality', severity: 'note', atomId: 'a', modality: 'recognition' },
        { code: 'atom_single_modality', severity: 'note', atomId: 'b', modality: 'recognition' },
        { code: 'atom_single_modality', severity: 'note', atomId: 'c', modality: 'recall' },
      ]),
      label,
    );

    expect(rows.map((r) => [r.code, r.values.count])).toEqual([
      ['atom_single_modality_recognition', 2],
      ['atom_single_modality_recall', 1],
    ]);
  });
});
