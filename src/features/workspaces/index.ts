export type { WorkspaceContext, WorkspacesResponse, SchoolRole } from './types';
export { toContextKey, STAFF_ROLES } from './types';
export { useWorkspaces, useActivateWorkspace, workspacesKeys, contextToUrl } from './api/use-workspaces';
// getWorkspaces is server-only — import directly from './api/get-workspaces' in server components
export { WorkspaceSwitcher } from './components/workspace-switcher';
export { RoleBadge } from './components/role-badge';
