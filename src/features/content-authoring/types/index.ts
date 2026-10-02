import type { Recipe, RecipeIssue } from '@/lib/shared-kernel/skills';

/** Three-state lifecycle per the Course Management spec (CF-4). */
export type ContainerState = 'draft' | 'published' | 'archived';

/** @deprecated Use ContainerState. Kept for backward-compat with AuthoringFilters. */
export type ContainerStatus = 'draft' | 'published';

/** School-level role of the current user for a given container. */
export type SchoolRole = 'owner' | 'admin' | 'teacher';

export interface AuthoringFilters {
  status?: ContainerStatus;
}

// ─── Course List ─────────────────────────────────────────────────────────────

export interface ContainerListQuery {
  search?: string;
  state?: ContainerState | 'all';
  language?: string;
  level?: string;
  sort?: 'recently_edited' | 'name_asc';
  page?: number;
  pageSize?: number;
}

export interface ContainerStateCounts {
  all: number;
  draft: number;
  published: number;
  archived: number;
}

export interface ContainerListResponse {
  items: import('@/features/content/types').Container[];
  total: number;
  page: number;
  pageSize: number;
  counts: ContainerStateCounts;
}

// ─── Pre-flight ──────────────────────────────────────────────────────────────

export type CheckSeverity = 'blocker' | 'warning' | 'ok';

export interface PreflightCheck {
  id: string;
  severity: CheckSeverity;
  /**
   * content-service rule code (`get-preflight.handler.ts`). The copy lives in
   * `Authoring.preflightRules`, resolved by `preflightCheckText` — the check
   * itself carries no user-facing English.
   */
  ruleCode: string;
  /**
   * Display name of the offending item, when the rule names one that the
   * version places. "Exercise has no instructions" is not actionable in a
   * module of sixteen items; the name is what makes it so.
   */
  itemTitle: string | null;
  /** content-service's own wording — the fallback for a rule the UI has no copy for. */
  detail: string;
  fixDeepLink: string | null;
}

export interface PreflightResult {
  blockerCount: number;
  warningCount: number;
  checks: PreflightCheck[];
  canPublish: boolean;
  canPublishAnyway: boolean;
}

// ─── Audit / Activity ────────────────────────────────────────────────────────

export type AuditEntityType =
  | 'CONTAINER'
  | 'LESSON'
  | 'EXERCISE'
  | 'VOCABULARY_LIST'
  | 'GRAMMAR_RULE';

/**
 * What happened. Open-ended on purpose, mirroring the service: new actions ship
 * without a migration there and must not fail to parse here. The union names the
 * ones that exist so the UI can switch on them and still compile.
 */
export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'published'
  | 'unpublished'
  | 'archived'
  | 'restored'
  | 'instructions_updated'
  | (string & {});

export interface ActivityEntry {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  /** Resolved by the service at read time; null once the entity is gone. */
  entityTitle: string | null;
  action: AuditAction;
  actorUserId: string;
  /**
   * Resolved by the BFF from the profile service. Null when the directory did
   * not answer or has no profile for the id — the entry still stands, and the
   * panel says so rather than showing a UUID.
   */
  actor: { userId: string; displayName: string; avatarUrl?: string } | null;
  changedFields: string[];
  /** ISO 8601. Also the cursor: pass the oldest one back as `before`. */
  occurredAt: string;
}

export interface ContainerActivity {
  entries: ActivityEntry[];
  hasMore: boolean;
}

// ─── Coverage: what a course actually trains (plan 55 §3.7) ─────────────────

/**
 * The three axes, mirrored from `@ssz/shared-kernel/skills`.
 *
 * Restated here rather than imported: the kernel is a package of the services
 * repository and the web app does not depend on it. The lists are canonical —
 * the order below is the order every row of the strip is drawn in — and they
 * change only when the kernel's do.
 */
export const COVERAGE_SKILLS = ['listening', 'reading', 'spoken', 'written'] as const;
export type CoverageSkill = (typeof COVERAGE_SKILLS)[number];

export const COVERAGE_FOCUSES = ['vocabulary', 'grammar', 'orthography', 'pragmatics'] as const;
export type CoverageFocus = (typeof COVERAGE_FOCUSES)[number];

export const COVERAGE_FORMS = ['bank', 'free', 'mixed', 'unknown'] as const;
export type CoverageForm = (typeof COVERAGE_FORMS)[number];

/** How the answer had to be known — the axis the report reads since plan 64, decision G. */
export const COVERAGE_MODALITIES = ['recognition', 'recall', 'production', 'unknown'] as const;
export type CoverageModality = (typeof COVERAGE_MODALITIES)[number];

export interface CoverageTallies {
  /** Exercises counted. Not the sum of any row: one exercise can train two channels. */
  total: number;
  bySkill: Record<CoverageSkill, number>;
  byFocus: Record<CoverageFocus | 'unknown', number>;
  /** Whether a bank was on screen. Kept by the service for its rules; not drawn. */
  byForm: Record<CoverageForm, number>;
  /**
   * How the answer had to be known. The third row of the report: `byForm` puts chunks to
   * order and options to pick in one bucket, this does not (plan 64, decision G).
   */
  byModality: Record<CoverageModality, number>;
  /**
   * The `skill × focus` table the two tallies above are the margins of.
   *
   * Needed because a pair can be empty while neither of its margins is: a course with
   * twelve listening exercises and forty grammar ones may contain no listening-grammar
   * exercise at all. Screen E asks exactly that question — "taught but nobody got there"
   * against "not taught at all" — and only a cell of this table separates the two.
   */
  byPair: Record<CoverageSkill, Record<CoverageFocus | 'unknown', number>>;
  /** Channels nothing trains, named by the service rather than diffed out of `bySkill`. */
  emptySkills: CoverageSkill[];
  /** Exercises whose template the axis table does not know. */
  unclassified: number;
}

/**
 * A remark about the balance of a module, as a code and the numbers its
 * sentence needs. The wording is written here, in four languages; the rule that
 * produced it is not re-implemented (§1.7 — every validation surface in the UI
 * is a filter over the kernel's output).
 */
export type CoverageIssue =
  | { code: 'COV_SKILL_ABSENT'; level: 'warning'; skill: CoverageSkill }
  | { code: 'COV_SINGLE_SKILL'; level: 'warning'; skill: CoverageSkill; total: number }
  | { code: 'COV_NO_FREE_PRODUCTION'; level: 'warning'; total: number }
  | { code: 'COV_MOSTLY_BANK'; level: 'info'; bank: number; total: number }
  | { code: 'COV_FOCUS_UNKNOWN'; level: 'info'; unknown: number; total: number }
  | { code: 'COV_UNCLASSIFIED'; level: 'warning'; count: number };

/** The lesson recipe speaks the kernel's vocabulary; the copy in this repo is the source. */
export type { Recipe, RecipeIssue, RecipeRule } from '@/lib/shared-kernel/skills';

export interface CoverageModuleReport {
  containerId: string;
  title: string;
  coverage: CoverageTallies;
  issues: CoverageIssue[];
  /**
   * What this lesson lacks against the course's recipe (plan 64, decisions L–P), counted
   * in items rather than exercises. Warnings only. Optional because a report from a
   * service older than phase 10 does not carry it, and that reads as "nothing to say".
   */
  recipeIssues?: RecipeIssue[];
}

export interface CoverageReport {
  version: 'draft' | 'published';
  /**
   * False when the container has no such version. A course nobody published has
   * no published coverage, which is a different claim from a course of zeroes.
   */
  available: boolean;
  coverage: CoverageTallies;
  issues: CoverageIssue[];
  modules: CoverageModuleReport[];
}

/** A cell the draft and the published version disagree about. */
export interface CoverageDifference {
  axis: 'skill' | 'focus' | 'form';
  key: string;
  draft: number;
  published: number;
}

export interface ContainerCoverage {
  containerId: string;
  containerType: string;
  title: string;
  /** The recipe the lessons were checked against — the course's, its workspace's, or empty. */
  recipe?: Recipe;
  draft: CoverageReport | null;
  published: CoverageReport | null;
  /** Decided by the service, so the web, the mobile app and every later reader agree. */
  diverges: boolean;
  differences: CoverageDifference[];
}

export type CoverageVersionScope = 'draft' | 'published' | 'both';

// ─── Atom coverage (plan 63 §4.2) ────────────────────────────────────────────
//
// The coverage report above counts exercises by channel and subject. This one counts the
// facts: the words a unit's texts introduce and the atoms of the rules it teaches,
// against the items that name them. Different question, different shape, same rule about
// where the thinking lives — the service decides, this is a renderer over its answer.

export const MODALITIES = ['recognition', 'recall', 'production', 'unknown'] as const;
export type Modality = (typeof MODALITIES)[number];

export type ModalityTally = Record<Modality, number>;

/** Where a scope says it teaches an atom. Empty means it only practises it. */
export type AtomIntroductionSource = 'relation' | 'glossary' | 'text_span' | 'exercise_pool';

export interface AtomCoverageEntry {
  atomType: 'vocabulary_item' | 'grammar_rule_atom' | string;
  atomId: string;
  title: string;
  track: 'lexis' | 'grammar' | string;
  parentId: string | null;
  parentTitle: string | null;
  introducedBy: AtomIntroductionSource[];
  exercises: number;
  /** Items that test it. Zero is what "never tested" counts. */
  focusItems: number;
  /** Items that merely required it — the word inside a gap testing an ending. */
  contextItems: number;
  /** Testing items by modality. Context is not here: it examined nothing. */
  byModality: ModalityTally;
}

/**
 * A finding, as a code and the numbers its sentence needs — the same contract the
 * skill report's remarks follow, and for the same reason: the wording is written here
 * in four languages, the rule is not re-implemented.
 */
export interface AtomCoverageIssue {
  code: string;
  severity: 'warning' | 'note';
  atomType?: string;
  atomId?: string;
  title?: string;
  ruleId?: string;
  modality?: Modality;
  count?: number;
  total?: number;
}

export interface AtomCoverageSummary {
  introduced: number;
  introducedByTrack: Record<string, number>;
  tested: number;
  untested: number;
  contextOnly: number;
  singleModality: number;
  practisedElsewhere: number;
  byModality: ModalityTally;
  exercises: number;
  /** Of those, the ones carrying any address at all — what every finding is read against. */
  exercisesAddressed: number;
}

export interface AtomCoverageScope {
  containerId: string;
  title: string;
  summary: AtomCoverageSummary;
  issues: AtomCoverageIssue[];
}

export interface AtomCoverage {
  containerId: string;
  containerType: string;
  title: string;
  version: 'draft' | 'published';
  /** False when there is no such version — not a container that teaches nothing. */
  available: boolean;
  summary: AtomCoverageSummary;
  issues: AtomCoverageIssue[];
  atoms: AtomCoverageEntry[];
  rulesWithoutAtoms: Array<{ ruleId: string; title: string }>;
  units: AtomCoverageScope[];
}

export type AtomCoverageVersionScope = 'draft' | 'published';

/** Which rung of the priority chain produced a value (plan 55 §3.4). */
export const SKILL_SOURCES = ['override', 'placement', 'document', 'template', 'unknown'] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];

/** The focus chain is shorter: neither placement nor the document says anything about the subject. */
export const FOCUS_SOURCES = ['override', 'atoms', 'template', 'unknown'] as const;
export type FocusSource = (typeof FOCUS_SOURCES)[number];

/**
 * What one exercise trains, and where that answer came from.
 *
 * The two sources are the point of the panel, not decoration: an author who cannot tell
 * "the template guessed this" from "you declared this" will either never correct a wrong
 * value or overwrite a right one.
 */
export interface ExerciseAxes {
  skills: CoverageSkill[];
  focus: CoverageFocus[];
  form: CoverageForm;
  /**
   * Absent from the service's answer today, which is why it is optional: only the live
   * draft in the builder fills it (`mergeAxes`).
   */
  modality?: CoverageModality;
  skillSource: SkillSource;
  focusSource: FocusSource;
}

// ─── Course structure (curriculum tree) ─────────────────────────────────────

/** The node currently selected in the CurriculumTree, shown in the Inspector. */
export type CurriculumTreeSelection =
  | { kind: 'level'; level: import('@/features/content/types').CurriculumTreeLevelNode }
  | { kind: 'module'; module: import('@/features/content/types').CurriculumTreeModuleNode }
  | {
      kind: 'item';
      item: import('@/features/content/types').CurriculumTreeItemNode;
      sectionTitle: string | null;
      /** The section holding the row — a level, for material the course keeps itself. */
      sectionId: string | null;
      /**
       * The container whose draft version places this row: the module it sits
       * in, or the course itself. Everything acting on the row — the editor
       * link, reassigning its section — addresses that container, not the
       * course the tree was opened on.
       */
      containerId: string;
    };

// ─── Screen E: what came out of the course (plan 58 §3.5) ──────────────────

/**
 * One `skill × focus` cell, as analytics counted it over everybody who took the course.
 *
 * No learner is named here, in any form — not by id, not by being alone in a cell. That
 * is why `learners` is a count: a cell of one is one person's profile wearing the
 * course's name, and the screen is told so rather than left to draw a conclusion from it.
 *
 * `items` is deliberately not part of this — it comes from the coverage report loaded
 * beside it (plan 58 §2 C), so that "how many exercises" has one source.
 */
export interface CourseResultCell {
  skill: string;
  focus: string;
  attempts: number;
  /** Whole percent, weighted by evidence rather than by head. `null` when nothing was weighed. */
  ewma: number | null;
  learners: number;
  weightedSample: number;
}

export interface CourseResult {
  containerId: string;
  minWeightedSample: number;
  learners: number;
  /** Groups whose attempts were recorded. Undercounts history older than the column. */
  groups: number;
  /** Only the cells somebody attempted; the grid supplies the rest from coverage. */
  cells: CourseResultCell[];
}

// ─── What each piece of an exercise is about (plan 63 §2 D) ─────────────────

export type AtomType = 'vocabulary_item' | 'grammar_rule_atom';
export type TargetRole = 'focus' | 'context';

/**
 * One atom an item is about, resolved against the exercise as it stands now.
 *
 * `broken` is computed on every read and never stored, because neither half of a target is
 * stable on its own: a gap key holds a token index, so editing the sentence moves it
 * (`item_missing`), and the atom underneath can be retired (`atom_missing`). The panel
 * reports both rather than hiding them — a target silently dropped is an author believing
 * a gap is addressed when it is not.
 */
export interface ResolvedTarget {
  atomType: AtomType;
  atomId: string;
  role: TargetRole;
  /** `null` when the atom is gone; `broken` then says `atom_missing`. */
  atomTitle: string | null;
  track: string | null;
  broken: 'atom_missing' | 'item_missing' | null;
}

export interface ItemTargets {
  /** `null` addresses the whole exercise — the only option for templates that grade as one. */
  itemKey: string | null;
  label: string | null;
  targets: ResolvedTarget[];
}

export interface ExerciseTargets {
  exerciseId: string;
  templateCode: string;
  /** False when the template grades as a whole; `items` then holds one `itemKey: null` row. */
  addressable: boolean;
  items: ItemTargets[];
}

export interface TargetSuggestion {
  atomType: AtomType;
  atomId: string;
  title: string;
  track: string;
  role: TargetRole;
  /** `word_exact` | `word_inflected` | `rule_single_atom` | `rule_candidate`. */
  reason: string;
  /** False where the author has to choose — a rule with several atoms, or an ambiguous word. */
  confident: boolean;
}

export interface ItemSuggestions {
  itemKey: string | null;
  label: string | null;
  alreadyAddressed: boolean;
  suggestions: TargetSuggestion[];
}

export interface TargetSuggestions {
  exerciseId: string;
  templateCode: string;
  items: ItemSuggestions[];
  /** Rules this exercise practises that nobody has cut into atoms yet. */
  rulesWithoutAtoms: Array<{ ruleId: string; title: string }>;
}
