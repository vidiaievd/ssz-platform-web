import { describe, expect, it } from 'vitest';

import type { AtomCoverage, ContainerCoverage } from '../types';

import { buildTriage } from './coverage-triage';
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
