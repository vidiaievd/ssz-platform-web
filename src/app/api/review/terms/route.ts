import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import { resolveReviewScope } from '@/features/review/lib/review-scope';
import { termWeek } from '@/features/review/lib/term-window';
import type { ReviewTermsSummary } from '@/features/review/types';

/**
 * The teacher's own line from the auto-acceptance journal (plan 80, step 7e).
 *
 * Asked of analytics for the caller and nobody else: the teacher id is the session's, never
 * a parameter, so a teacher reads their own figures and not a colleague's — the per-teacher
 * breakdown belongs to the oversight screen and its roles. Membership in the school is the
 * same check as the queue's; the groups themselves are attributed by analytics, which asks
 * organization-service who answered for each group on the day its term ran out.
 *
 * `null` rather than an error when analytics is not configured or cannot answer (it is a
 * 503 there without organization-service): the line is a footnote to the inbox, and the
 * inbox must not fail for it — nor show a zero that claims the term closed nothing.
 */
export async function GET(request: NextRequest) {
  const school = request.nextUrl.searchParams.get('school');
  if (!school) {
    return NextResponse.json({ error: 'school is required' }, { status: 400 });
  }

  const scope = await resolveReviewScope(school);
  if (scope instanceof NextResponse) return scope;

  if (!env.ANALYTICS_SERVICE_INTERNAL_URL || !env.INTERNAL_SERVICE_TOKEN) {
    return NextResponse.json(null);
  }

  const { from, to } = termWeek(new Date());

  try {
    const line = await serverFetch<ReviewTermsSummary>({
      service: 'analytics',
      path: `/internal/review-terms/schools/${scope.schoolId}/teachers/${scope.teacherId}`,
      directBaseUrl: env.ANALYTICS_SERVICE_INTERNAL_URL,
      query: { from, to },
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN },
      anonymous: true,
    });

    const body: ReviewTermsSummary = {
      accepted: line.accepted,
      revised: line.revised,
      overturned: line.overturned,
      from: line.from,
      to: line.to,
    };
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(null);
  }
}
