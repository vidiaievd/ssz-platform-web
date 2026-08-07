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
  /** Unresolved — content-service holds no user directory. */
  actorUserId: string;
  changedFields: string[];
  /** ISO 8601. Also the cursor: pass the oldest one back as `before`. */
  occurredAt: string;
}

export interface ContainerActivity {
  entries: ActivityEntry[];
  hasMore: boolean;
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
    };
