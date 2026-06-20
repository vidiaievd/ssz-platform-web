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
  title: string;
  fixHint: string | null;
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

export type AuditEventType =
  | 'container.created'
  | 'container.updated'
  | 'container.published'
  | 'container.unpublished'
  | 'container.archived'
  | 'container.restored'
  | 'container.deleted';

export interface AuditEvent {
  id: string;
  containerId: string;
  actor: { userId: string; name: string; avatarUrl?: string };
  type: AuditEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}
