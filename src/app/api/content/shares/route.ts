import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ContainerShare } from '@/features/content/types';
import { entityTypeToUrlSlug, permissionToShareRole } from '@/features/content-authoring/lib/share-mapping';

interface ContentShareResponse {
  id: string;
  entityType: string;
  entityId: string;
  sharedWithUserId: string;
  permission: string;
  createdAt: string;
}

interface ProfileSummary {
  userId: string;
  displayName: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');

  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
  }
  try {
    const shares = await serverFetch<ContentShareResponse[]>({
      service: 'content',
      path: `/${entityTypeToUrlSlug(entityType)}/${entityId}/shares`,
    });

    const names = await resolveDisplayNames(shares.map((s) => s.sharedWithUserId));

    const result: ContainerShare[] = shares.map((s) => ({
      id: s.id,
      entityType: s.entityType,
      entityId: s.entityId,
      userId: s.sharedWithUserId,
      userName: names.get(s.sharedWithUserId),
      role: permissionToShareRole(s.permission),
      createdAt: s.createdAt,
    }));

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 502 });
  }
}

// Batch-resolve display names for the share list. Email is intentionally not
// shown — profile-service's batch lookup only exposes displayName, not email.
async function resolveDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) return new Map();

  try {
    const profiles = await serverFetch<ProfileSummary[]>({
      service: 'profile',
      path: '/profiles',
      query: { userIds: uniqueIds.join(',') },
    });
    return new Map(profiles.map((p) => [p.userId, p.displayName]));
  } catch {
    return new Map();
  }
}
