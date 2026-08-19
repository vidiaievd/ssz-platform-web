import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import type { SchoolReviewSettings } from '@/features/review/types/oversight';

/**
 * The response time a school promises, and what happens when it passes.
 *
 * A thin pass-through on purpose. organization-service owns both the bounds and the
 * permission — this route resolves a slug to an id, because the address bar carries slugs
 * and the service takes ids, and otherwise stays out of the way. Duplicating the
 * validation here would mean two sets of numbers to keep in step; the form mirrors them
 * for the sake of an error before the round trip, and the service remains the authority.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const settings = await serverFetch<SchoolReviewSettings>({
      service: 'organization',
      path: `/schools/${schoolId}/review-settings`,
    });
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(errorBody(error), { status: statusOf(error, 502) });
  }
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
    const settings = await serverFetch<SchoolReviewSettings>({
      service: 'organization',
      path: `/schools/${schoolId}/review-settings`,
      method: 'PUT',
      body,
    });
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(errorBody(error), { status: statusOf(error, 502) });
  }
}

/** The upstream's own refusal, carried through: the form shows it on the field. */
function errorBody(error: unknown): unknown {
  if (error instanceof AppError && error.code === 'validation') {
    return { error: 'validation', details: error.details };
  }
  if (error instanceof AppError && error.code === 'forbidden') {
    return { error: 'Forbidden' };
  }
  return { error: 'The response time could not be read' };
}

function statusOf(error: unknown, fallback: number): number {
  if (!(error instanceof AppError)) return fallback;
  if (error.code === 'validation') return 422;
  if (error.code === 'forbidden') return 403;
  if (error.code === 'not_found') return 404;
  if (error.code === 'unauthenticated') return 401;
  return fallback;
}
