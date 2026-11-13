import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { Entitlements } from '@/features/entitlements';

/**
 * The rights of a workspace — a school — for a client that has to decide whether to draw a
 * paid control the layout's own entitlements do not cover (a learner's layout reads the
 * learner's own plan; «Check» before hand-in is the school's, plan 84).
 *
 * `null` for anything that is not a plain answer: a person who is not a member, or a service
 * that is down, is «no rights to show». Only hides a button — the service behind it checks.
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId');
  if (workspaceId === null || workspaceId === '') {
    return NextResponse.json({ error: '"workspaceId" is required' }, { status: 400 });
  }

  try {
    const data = await serverFetch<Entitlements>({
      service: 'subscription',
      path: '/subscriptions/me',
      query: { workspaceId },
      expectedErrorStatuses: [403, 503],
    });
    return NextResponse.json(data);
  } catch (e) {
    if (isAppError(e) && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(null);
  }
}
