import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import type { ActivityEntry, ContainerActivity } from '@/features/content-authoring/types';

/** What content-service returns: entries with actor ids and no names. */
type RawActivity = Omit<ContainerActivity, 'entries'> & {
  entries: Omit<ActivityEntry, 'actor'>[];
};

/**
 * Who changed this course and the material it places.
 *
 * The join happens here rather than in content-service, which holds no user
 * directory and should not grow one: names belong to profiles, and a service
 * that copied them would be serving a stale name the day someone marries.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limit = request.nextUrl.searchParams.get('limit');
  const before = request.nextUrl.searchParams.get('before');

  let activity: RawActivity;
  try {
    activity = await serverFetch<RawActivity>({
      service: 'content',
      path: `/containers/${id}/activity`,
      query: {
        ...(limit ? { limit } : {}),
        ...(before ? { before } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 502 });
  }

  const profiles = await fetchProfileSummaries(activity.entries.map((entry) => entry.actorUserId));

  return NextResponse.json({
    entries: activity.entries.map((entry) => ({
      ...entry,
      // A name we could not resolve is left null rather than filled with the id:
      // the panel says "someone" far more usefully than it says a UUID.
      actor: profiles[entry.actorUserId] ?? null,
    })),
    hasMore: activity.hasMore,
  } satisfies ContainerActivity);
}
