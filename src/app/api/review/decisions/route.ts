import { type NextRequest, NextResponse } from 'next/server';

import { resolveOversightAccess } from '@/features/review/lib/review-scope';
import { fetchDecisionsPage } from '@/features/review/lib/decisions';
import { OVERSIGHT_PERIODS, type OversightPeriod } from '@/features/review/types/oversight';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Who decided what, newest first (`API_CONTRACT.md` §6).
 *
 * A journal rather than a report: no totals, no ranking of teachers, nothing that could be
 * read as a scorecard. It answers "what happened here", which is the question an
 * administrator actually has when a learner writes in about a verdict — and it includes
 * the administrator's own decisions under their own name (criterion 32).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const school = searchParams.get('school');
  if (!school) {
    return NextResponse.json({ error: 'school is required' }, { status: 400 });
  }

  const access = await resolveOversightAccess(school);
  if (access instanceof NextResponse) return access;

  const period = Number(searchParams.get('period'));
  const periodDays: OversightPeriod = OVERSIGHT_PERIODS.includes(period as OversightPeriod)
    ? (period as OversightPeriod)
    : 30;

  const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_LIMIT, MAX_LIMIT);

  try {
    const page = await fetchDecisionsPage({
      schoolId: access.schoolId,
      periodDays,
      limit,
      cursor: searchParams.get('cursor'),
    });
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ error: 'The journal could not be read' }, { status: 502 });
  }
}
