import type {
  AtomCoverage,
  AtomCoverageIssue,
  ContainerCoverage,
  CoverageIssue,
  RecipeIssue,
  RecipeRule,
} from '../types';

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
  source: 'skill' | 'atom' | 'recipe';
  code: string;
  /** Every argument any of the messages might name; next-intl ignores the rest. */
  values: Record<string, string | number>;
  /** `null` for a finding with no single place to send anyone. */
  target: TriageTarget | null;
  /** The recipe rule a `recipe` row is about — the row names it and the types that close it. */
  rule?: RecipeRule;
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

/**
 * One row per failed rule of the lesson recipe, not one per lesson (plan 64, decision P).
 *
 * The service judges each lesson; a course of fifty lessons that all lack listening is one
 * thing to do, and fifty rows saying it would bury the rest of the triage. The row says how
 * many lessons fall short, and the tree carries the per-lesson dot. A floor nobody meets
 * is loud — nothing of that kind is trained — and an exceeded ceiling is a balance remark.
 * Lessons with nothing in them are not counted in the denominator: the service does not
 * judge them, and "3 of 13" where ten are empty would read as a course mostly fine.
 */
function recipeRows(coverage: ContainerCoverage | undefined): TriageRow[] {
  const modules = coverage?.draft?.modules ?? [];
  const judged = modules.filter((lesson) => lesson.coverage.total > 0).length;
  const byRule = new Map<string, { code: string; rule: RecipeRule; lessons: number }>();

  for (const lesson of modules) {
    for (const issue of lesson.recipeIssues ?? []) {
      const key = `${issue.code}:${issue.ruleIndex}`;
      const entry = byRule.get(key) ?? { code: issue.code, rule: issue.rule, lessons: 0 };
      entry.lessons += 1;
      byRule.set(key, entry);
    }
  }

  return [...byRule.entries()].map(([key, entry]) => ({
    key: `recipe:${key}`,
    severity: entry.code === 'RECIPE_BELOW_MIN' ? 'high' : 'low',
    source: 'recipe',
    code: entry.code,
    values: { lessons: entry.lessons, total: judged },
    target: null,
    rule: entry.rule,
  }));
}

/**
 * One row per kind of atom finding, however the service phrased it.
 *
 * content-service names a finding per atom — `atom_untested` once for each of 366 words,
 * with the word's title and no count — while the sentences here are written about the
 * whole scope ("{count} facts this teaches and never tests"). Unfolded, a course drew a
 * row per word, each saying "0 facts", and buried everything else in the triage. A scope
 * finding that already carries its count keeps it. `atom_single_modality` is split by its
 * modality, because each modality has a sentence of its own.
 */
function foldAtomIssues(
  issues: readonly AtomCoverageIssue[],
): { code: string; issue: AtomCoverageIssue; count: number }[] {
  const folded = new Map<string, { code: string; issue: AtomCoverageIssue; count: number }>();
  for (const issue of issues) {
    const code =
      issue.code === 'atom_single_modality' && issue.modality
        ? `${issue.code}_${issue.modality}`
        : issue.code;
    const entry = folded.get(code);
    if (entry) entry.count += issue.count ?? 1;
    else folded.set(code, { code, issue, count: issue.count ?? 1 });
  }
  return [...folded.values()];
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

  for (const { code, issue, count } of foldAtomIssues(atoms?.issues ?? [])) {
    const row = ATOM_ROWS[code];
    const values = { ...atomValues(issue), count };
    if (row) {
      rows.push({
        key: `atom:${code}`,
        severity: row.severity,
        source: 'atom',
        code,
        values,
        target: row.target,
      });
    } else if (ATOM_NOTES.includes(code)) {
      notes.push({ key: `atom:${code}`, source: 'atom', code, values });
    }
  }

  rows.push(...recipeRows(coverage));

  // The loud ones first, and within a rung the order the services listed them:
  // that order is the kernel's judgement, and reshuffling it here would be a
  // second opinion about what matters most.
  rows.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));

  return { rows, notes };
}

/**
 * The recipe's remarks keyed by the lesson they are about, for the dots in the tree.
 *
 * Read off the draft report, because the tree is the draft: a dot that described what
 * students currently have would disappear only after publishing the fix, which is the
 * opposite of what an author adding the missing exercise expects to see.
 */
export function recipeIssuesByModule(
  coverage: ContainerCoverage | undefined,
): ReadonlyMap<string, readonly RecipeIssue[]> {
  const out = new Map<string, readonly RecipeIssue[]>();
  for (const lesson of coverage?.draft?.modules ?? [])
    if (lesson.recipeIssues && lesson.recipeIssues.length > 0)
      out.set(lesson.containerId, lesson.recipeIssues);
  return out;
}
