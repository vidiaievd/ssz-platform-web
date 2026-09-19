import type { AtomCoverage, AtomCoverageIssue, ContainerCoverage, CoverageIssue } from '../types';

/** Where a triage button drops the author in the tree. */
export interface TriageTarget {
  type: 'exercises' | 'grammar' | 'vocab' | 'text';
  state?: 'draft' | 'edited' | 'published';
}

export interface TriageRow {
  key: string;
  /** `high` draws the red `!`, `low` the amber `·`. */
  severity: 'high' | 'low';
  /** Which message table the code belongs to. */
  source: 'skill' | 'atom';
  code: string;
  /** Every argument any of the messages might name; next-intl ignores the rest. */
  values: Record<string, string | number>;
  /** `null` for a finding with no single place to send anyone. */
  target: TriageTarget | null;
}

/** A footnote: true, worth knowing, and not something to act on row by row. */
export interface TriageNote {
  key: string;
  source: 'skill' | 'atom';
  code: string;
  values: Record<string, string | number>;
}

/**
 * Findings that are worth acting on, and findings that are worth knowing.
 *
 * Both lists come from the services as codes and numbers — the rules live in
 * the kernel and are not re-implemented here (§1.7). What this decides is only
 * the reading order and which rung each finding belongs on, because the report
 * has nine of them and an author who is shown nine at once acts on none.
 *
 * Unknown codes fall out silently. A service that learns a new remark before
 * this client learns its sentence should be invisible, never fatal.
 */
const SKILL_ROWS: Record<string, { severity: 'high' | 'low'; target: TriageTarget | null }> = {
  COV_SKILL_ABSENT: { severity: 'high', target: { type: 'exercises' } },
  COV_SINGLE_SKILL: { severity: 'high', target: { type: 'exercises' } },
  COV_NO_FREE_PRODUCTION: { severity: 'high', target: { type: 'exercises' } },
  COV_MOSTLY_BANK: { severity: 'low', target: { type: 'exercises' } },
};

/** Said about the record rather than about the material: a note, not a task. */
const SKILL_NOTES = ['COV_FOCUS_UNKNOWN', 'COV_UNCLASSIFIED'];

const ATOM_ROWS: Record<string, { severity: 'high' | 'low'; target: TriageTarget | null }> = {
  atom_untested: { severity: 'high', target: { type: 'exercises' } },
  scope_no_production: { severity: 'high', target: { type: 'exercises' } },
  rule_without_atoms: { severity: 'high', target: { type: 'grammar' } },
  atom_context_only: { severity: 'low', target: { type: 'exercises' } },
  atom_single_modality_recognition: { severity: 'low', target: { type: 'exercises' } },
  atom_single_modality_recall: { severity: 'low', target: { type: 'exercises' } },
  atom_single_modality_production: { severity: 'low', target: { type: 'exercises' } },
  atom_single_modality_unknown: { severity: 'low', target: { type: 'exercises' } },
};

const ATOM_NOTES = ['atom_unknown_modality'];

function skillValues(issue: CoverageIssue, skillLabel: (skill: string) => string) {
  return {
    skill: 'skill' in issue ? skillLabel(issue.skill) : '',
    total: 'total' in issue ? issue.total : 0,
    bank: 'bank' in issue ? issue.bank : 0,
    unknown: 'unknown' in issue ? issue.unknown : 0,
    count: 'count' in issue ? issue.count : 0,
  };
}

function atomValues(issue: AtomCoverageIssue) {
  return {
    count: issue.count ?? 0,
    total: issue.total ?? 0,
    title: issue.title ?? '',
  };
}

export interface Triage {
  rows: TriageRow[];
  notes: TriageNote[];
}

export function buildTriage(
  coverage: ContainerCoverage | undefined,
  atoms: AtomCoverage | undefined,
  /** Channel names are translated where the caller can translate them. */
  skillLabel: (skill: string) => string,
): Triage {
  const rows: TriageRow[] = [];
  const notes: TriageNote[] = [];

  for (const issue of coverage?.draft?.issues ?? []) {
    const row = SKILL_ROWS[issue.code];
    const values = skillValues(issue, skillLabel);
    if (row) {
      rows.push({
        key: `skill:${issue.code}:${'skill' in issue ? issue.skill : ''}`,
        severity: row.severity,
        source: 'skill',
        code: issue.code,
        values,
        target: row.target,
      });
    } else if (SKILL_NOTES.includes(issue.code)) {
      notes.push({ key: `skill:${issue.code}`, source: 'skill', code: issue.code, values });
    }
  }

  for (const issue of atoms?.issues ?? []) {
    const row = ATOM_ROWS[issue.code];
    const values = atomValues(issue);
    if (row) {
      rows.push({
        key: `atom:${issue.code}`,
        severity: row.severity,
        source: 'atom',
        code: issue.code,
        values,
        target: row.target,
      });
    } else if (ATOM_NOTES.includes(issue.code)) {
      notes.push({ key: `atom:${issue.code}`, source: 'atom', code: issue.code, values });
    }
  }

  // The loud ones first, and within a rung the order the services listed them:
  // that order is the kernel's judgement, and reshuffling it here would be a
  // second opinion about what matters most.
  rows.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));

  return { rows, notes };
}
