import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';

type Params = { params: Promise<{ id: string }> };

/**
 * Screen E's other half — what came out of a course, beside what the course trains.
 *
 * No role check here, unlike the group screens (plan 58 §2 F): the answer aggregates
 * everybody who took the course and names nobody, and analytics itself is already
 * narrower than the screen — owner of the course, or somebody in the school that owns
 * it, and a course shared into another school is refused outright. There is no rule left
 * for the BFF to add that analytics does not already enforce.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const data = await serverFetch({
      service: 'analytics',
      path: `/analytics/containers/${id}/result`,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    // Analytics being down must read as "we could not ask", never as a course nobody
    // has taken — the grid draws a different picture for each.
    return NextResponse.json({ error: 'Failed to fetch course result' }, { status: 502 });
  }
}
