import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { CourseReviewSettings } from '@/features/review/types/oversight';

/**
 * A course's own response time, and the school's behind it.
 *
 * Both numbers always travel, in both directions: the field on the settings drawer is
 * never blank, and when the override is switched off it shows the inherited value greyed
 * rather than nothing (criterion 35). content-service resolves the inheritance, so this
 * route neither computes nor guesses it.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const settings = await serverFetch<CourseReviewSettings>({
      service: 'content',
      path: `/containers/${id}/review-settings`,
    });
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: 'The response time could not be read' },
      {
        status: statusOf(error, 502),
      },
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { respondWithinHours?: number | null };
  try {
    body = (await request.json()) as { respondWithinHours?: number | null };
  } catch {
    return NextResponse.json({ error: 'A body is required' }, { status: 400 });
  }

  try {
    const settings = await serverFetch<CourseReviewSettings>({
      service: 'content',
      path: `/containers/${id}/review-settings`,
      method: 'PUT',
      // `null` is the request to inherit again, and has to survive the round trip as a
      // value rather than as an absent field (`API_CONTRACT.md` §7).
      body: { respondWithinHours: body.respondWithinHours ?? null },
    });
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: 'The response time could not be saved' },
      {
        status: statusOf(error, 502),
      },
    );
  }
}

function statusOf(error: unknown, fallback: number): number {
  if (!(error instanceof AppError)) return fallback;
  if (error.code === 'validation') return 422;
  if (error.code === 'forbidden') return 403;
  if (error.code === 'not_found') return 404;
  if (error.code === 'unauthenticated') return 401;
  return fallback;
}
