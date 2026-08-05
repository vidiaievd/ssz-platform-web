import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

/**
 * Lesson variants and grammar explanations are created as DRAFT, and the
 * student reader only ever resolves PUBLISHED ones. Nothing in the authoring UI
 * used to publish them, so a lesson or rule written here was invisible to
 * students *and* unpublishable: pre-flight raises a blocker for a lesson with
 * no published variant (`READ_NO_TITLE`) and a rule with no published
 * explanation (`DRAFT_ITEM`), with no way in the product to clear either.
 *
 * Saving now publishes them. That does not leak anything early: attaching the
 * lesson or rule to a module is a *composition* change, and composition only
 * reaches students when the module itself is published.
 *
 * These are not versions — one row per (language, level range), guarded by a
 * unique index — so the flag is one-way and re-publishing is a no-op conflict.
 */
async function publishIgnoringAlreadyLive(path: string): Promise<void> {
  try {
    await serverFetch({ service: 'content', path, method: 'POST' });
  } catch (err) {
    // 409 means it is already live, which is the end state we wanted.
    if (err instanceof AppError && err.code === 'conflict') return;
    throw err;
  }
}

export function ensureVariantPublished(lessonId: string, variantId: string): Promise<void> {
  return publishIgnoringAlreadyLive(`/lessons/${lessonId}/variants/${variantId}/publish`);
}

export function ensureExplanationPublished(ruleId: string, explanationId: string): Promise<void> {
  return publishIgnoringAlreadyLive(
    `/grammar-rules/${ruleId}/explanations/${explanationId}/publish`,
  );
}
