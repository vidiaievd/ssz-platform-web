import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import type { ContainerItem, ContainerVersion } from '@/features/content/types';

import type { PreflightResult } from '../types';
import { mapPreflightViolation, type RuleViolation } from './map-preflight-violation';

interface BackendPreflightResult {
  versionId: string;
  containerId: string;
  blockers: RuleViolation[];
  warnings: RuleViolation[];
}

const EMPTY_RESULT: PreflightResult = {
  blockerCount: 0,
  warningCount: 0,
  checks: [],
  canPublish: false,
  canPublishAnyway: false,
};

/**
 * Runs the real content-service pre-flight rule engine (BE5.1, `GetPreflightQuery`)
 * against a container's current draft version, and maps its rule violations to
 * the UI's `PreflightCheck` shape. That engine lives behind `/internal/*`
 * (InternalAuthGuard, not routed through the public gateway), so this call goes
 * directly to content-service via CONTENT_SERVICE_INTERNAL_URL.
 */
export async function getContainerPreflight(
  schoolSlug: string,
  containerId: string,
): Promise<PreflightResult> {
  const versionsResp = await serverFetch<{ items: ContainerVersion[] }>({
    service: 'content',
    path: `/containers/${containerId}/versions`,
  });
  const versionId =
    versionsResp.items.find((v) => v.status === 'draft')?.id ?? versionsResp.items[0]?.id;

  if (!versionId) return EMPTY_RESULT;

  const [backendResult, items] = await Promise.all([
    serverFetch<BackendPreflightResult>({
      service: 'content',
      path: `/internal/versions/${versionId}/preflight`,
      directBaseUrl: env.CONTENT_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
    }),
    serverFetch<ContainerItem[]>({
      service: 'content',
      path: `/containers/${containerId}/versions/${versionId}/items`,
    }),
  ]);

  const violations: RuleViolation[] = [...backendResult.blockers, ...backendResult.warnings];
  if (items.length === 0) {
    violations.unshift({
      ruleCode: 'EMPTY_VERSION',
      severity: 'blocker',
      itemType: 'VERSION',
      itemId: versionId,
      detail: 'Version has no items',
    });
  }

  const checks = violations.map((v) => mapPreflightViolation(v, { schoolSlug, containerId }));
  const blockerCount = checks.filter((c) => c.severity === 'blocker').length;
  const warningCount = checks.filter((c) => c.severity === 'warning').length;

  return {
    blockerCount,
    warningCount,
    checks,
    canPublish: blockerCount === 0,
    canPublishAnyway: false,
  };
}
