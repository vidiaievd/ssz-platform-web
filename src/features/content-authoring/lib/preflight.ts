import type { Container, ContainerItem } from '@/features/content/types';
import type { PreflightCheck, PreflightResult } from '../types';

/**
 * Pure function — runs all pre-flight rules against a container and its items.
 * Returns a PreflightResult with blockers, warnings, and OK checks.
 *
 * Rules per SPEC_state_machine.md → Pre-flight rules.
 */
export function runPreflight(
  container: Container,
  items: ContainerItem[],
  options?: { currentUserRole?: 'owner' | 'admin' | 'teacher' },
): PreflightResult {
  const role = options?.currentUserRole ?? 'owner';
  const checks: PreflightCheck[] = [];

  // ── Hard blockers ──────────────────────────────────────────────────────────

  checks.push({
    id: 'metadata.title_set',
    severity: container.title?.trim() ? 'ok' : 'blocker',
    title: 'Title required',
    fixHint: container.title?.trim() ? null : 'Add a course title',
    fixDeepLink: container.title?.trim() ? null : `/school/content/${container.id}/edit?focus=title`,
  });

  checks.push({
    id: 'metadata.language_set',
    severity: container.targetLanguage?.length >= 2 ? 'ok' : 'blocker',
    title: 'Language required',
    fixHint: container.targetLanguage?.length >= 2 ? null : 'Select a target language',
    fixDeepLink: container.targetLanguage?.length >= 2
      ? null
      : `/school/content/${container.id}/edit?focus=targetLanguage`,
  });

  checks.push({
    id: 'metadata.slug_unique',
    severity: container.slug ? 'ok' : 'blocker',
    title: 'Slug must be set',
    fixHint: container.slug ? null : 'A slug is required for publishing',
    fixDeepLink: container.slug ? null : `/school/content/${container.id}/edit?focus=slug`,
  });

  checks.push({
    id: 'owner.assigned',
    severity: container.ownerId ? 'ok' : 'blocker',
    title: 'Owner assigned',
    fixHint: null,
    fixDeepLink: null,
  });

  const hasItems = items.length > 0;
  checks.push({
    id: 'structure.has_lesson',
    severity: hasItems ? 'ok' : 'blocker',
    title: 'At least 1 lesson required',
    fixHint: hasItems ? null : 'Add at least one lesson',
    fixDeepLink: hasItems ? null : `/school/content/${container.id}?tab=lessons`,
  });

  // ── Warnings ───────────────────────────────────────────────────────────────

  checks.push({
    id: 'metadata.description_set',
    severity: container.description?.trim() ? 'ok' : 'warning',
    title: 'No course description',
    fixHint: container.description?.trim() ? null : 'Students will see "—" in the catalogue',
    fixDeepLink: container.description?.trim()
      ? null
      : `/school/content/${container.id}/edit?focus=description`,
  });

  checks.push({
    id: 'metadata.cover_set',
    severity: container.coverImageUrl ? 'ok' : 'warning',
    title: 'Cover image missing',
    fixHint: container.coverImageUrl ? null : 'Auto-fallback to language flag',
    fixDeepLink: null,
  });

  // ── Derived counts ─────────────────────────────────────────────────────────

  const blockerCount = checks.filter((c) => c.severity === 'blocker').length;
  const warningCount = checks.filter((c) => c.severity === 'warning').length;
  const canPublish = blockerCount === 0;
  const canPublishAnyway = blockerCount === 0 && role === 'owner';

  return { blockerCount, warningCount, checks, canPublish, canPublishAnyway };
}
