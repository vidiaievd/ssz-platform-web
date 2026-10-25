import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import { resolveOversightAccess } from '@/features/review/lib/review-scope';
import type {
  SchoolReviewEffort,
  SchoolReviewEffortMinutes,
} from '@/features/review/types/oversight';

/** exercise-engine's forecast inputs; only the norms are read here. */
interface EngineReviewEffort {
  norms: {
    templateCode: string;
    minutesPerSubmission: number;
    source: 'history' | 'school' | 'default';
    sampleSize: number;
  }[];
  historyDays: number;
  minSample: number;
}

/**
 * Minutes per submission a school expects, with what it has measured beside them (plan 81,
 * step 7).
 *
 * Two services. organization-service owns the figures and who may change them; the
 * measurements are exercise-engine's, read over its internal route — so they are asked for
 * only once the caller is somebody who oversees the school's review, and a failed read
 * leaves the figures on screen with the measurements missing rather than failing the page.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let minutes: SchoolReviewEffortMinutes;
  try {
    minutes = await serverFetch<SchoolReviewEffortMinutes>({
      service: 'organization',
      path: `/schools/${schoolId}/review-effort`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'The minutes per submission could not be read' },
      { status: statusOf(error, 502) },
    );
  }

  const body: SchoolReviewEffort = { ...minutes, measured: await readMeasured(id) };
  return NextResponse.json(body);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'A body is required' }, { status: 400 });
  }

  try {
    const minutes = await serverFetch<SchoolReviewEffortMinutes>({
      service: 'organization',
      path: `/schools/${schoolId}/review-effort`,
      method: 'PUT',
      body,
      expectedErrorStatuses: [400, 403, 422],
    });
    return NextResponse.json(minutes);
  } catch (error) {
    return NextResponse.json(
      { error: 'The minutes per submission could not be saved' },
      { status: statusOf(error, 502) },
    );
  }
}

/**
 * The school's medians, or null. Only a median the engine trusts is passed on: below the
 * sample the engine itself falls back to the school's figure, and a number shown beside
 * it would read as one that is being used.
 */
async function readMeasured(school: string): Promise<SchoolReviewEffort['measured']> {
  const access = await resolveOversightAccess(school);
  if (access instanceof NextResponse) return null;

  try {
    const effort = await serverFetch<EngineReviewEffort>({
      service: 'exercises',
      path: '/internal/attempts/review/effort',
      directBaseUrl: env.EXERCISE_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      query: { schoolId: access.schoolId },
    });
    return {
      historyDays: effort.historyDays,
      minSample: effort.minSample,
      templates: effort.norms.map((norm) => ({
        templateCode: norm.templateCode,
        sampleSize: norm.sampleSize,
        medianMinutes: norm.source === 'history' ? norm.minutesPerSubmission : null,
      })),
    };
  } catch (error) {
    console.error('[review-effort] measurements unreadable:', error);
    return null;
  }
}

function statusOf(error: unknown, fallback: number): number {
  if (!(error instanceof AppError)) return fallback;
  if (error.code === 'validation') return 422;
  if (error.code === 'forbidden') return 403;
  if (error.code === 'not_found') return 404;
  if (error.code === 'unauthenticated') return 401;
  if (error.code === 'upstream_unavailable') return 503;
  return fallback;
}
