'use server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { tryAction } from '@/lib/result';
import type { ContentTag } from '@/features/content/types';

import { tagEntitySegment } from '../lib/tag-entity';

function entityPath(entityType: string, entityId: string): string {
  const segment = tagEntitySegment(entityType);
  if (!segment) throw new AppError('validation', `Unknown taggable entity type: ${entityType}`);
  return `/${segment}/${entityId}/tags`;
}

/** Puts an existing tag (global, or the course's school's) on the entity. Idempotent. */
export async function assignTagAction(entityType: string, entityId: string, tagId: string) {
  return tryAction(async () => {
    await serverFetch({
      service: 'content',
      path: entityPath(entityType, entityId),
      method: 'POST',
      body: { tagId },
    });
  });
}

/**
 * A new tag is the school's own (`scope school`, category `other`) and goes straight onto the
 * entity. Only a school's material can get a new one: a global tag is the platform's to create.
 * The school checks the role (owner or content admin); anyone else gets `forbidden`.
 */
export async function createAndAssignTagAction(
  entityType: string,
  entityId: string,
  name: string,
  ownerSchoolId: string | null,
) {
  return tryAction(async () => {
    const trimmed = name.trim();
    if (!trimmed) throw new AppError('validation', 'Tag name is required');
    if (!ownerSchoolId) throw new AppError('forbidden', 'Only a school can create tags');

    const tag = await serverFetch<ContentTag>({
      service: 'content',
      path: '/tags',
      method: 'POST',
      body: { name: trimmed, category: 'other', scope: 'school', ownerSchoolId },
    });
    await serverFetch({
      service: 'content',
      path: entityPath(entityType, entityId),
      method: 'POST',
      body: { tagId: tag.id },
    });
    return tag;
  });
}

/** Takes the tag off this entity; the tag itself stays for everything else that carries it. */
export async function removeTagAction(entityType: string, entityId: string, tagId: string) {
  return tryAction(async () => {
    await serverFetch({
      service: 'content',
      path: `${entityPath(entityType, entityId)}/${tagId}`,
      method: 'DELETE',
    });
  });
}
