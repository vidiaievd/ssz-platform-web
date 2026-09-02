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

export interface CoverageTallies {
  /** Exercises counted. Not the sum of any row: one exercise can train two channels. */
  total: number;
  bySkill: Record<CoverageSkill, number>;
  byFocus: Record<CoverageFocus | 'unknown', number>;
  byForm: Record<CoverageForm, number>;
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

export interface CoverageModuleReport {
  containerId: string;
  title: string;
  coverage: CoverageTallies;
  issues: CoverageIssue[];
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
  draft: CoverageReport | null;
  published: CoverageReport | null;
  /** Decided by the service, so the web, the mobile app and every later reader agree. */
  diverges: boolean;
  differences: CoverageDifference[];
}

export type CoverageVersionScope = 'draft' | 'published' | 'both';

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
