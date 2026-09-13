export type { WorkspaceContext, WorkspacesResponse, SchoolRole } from './types';
export { toContextKey, STAFF_ROLES } from './types';
export { useWorkspaces, useActivateWorkspace, workspacesKeys, contextToUrl } from './api/use-workspaces';
// getWorkspaces is server-only — import directly from './api/get-workspaces' in server components
export { WorkspaceSwitcher } from './components/workspace-switcher';
export { RoleBadge } from './components/role-badge';
// wsHref is imported directly from './lib/href' at call sites — it is used by server
// components and tests that have no business pulling this barrel's React components in.
export { wsHref, type WorkspaceRef } from './lib/href';
export { useWorkspaceRef } from './lib/use-workspace-ref';
