import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { CourseReviewAiPolicy } from '@/features/review/types/oversight';

/**
 * A course's auto-accept term and teacher-only templates, with the school's behind them
 * (plan 80, step 2).
 *
 * content-service resolves the inheritance and the escalation floor; this route only keeps
 * the two fields' shape on the way in, so `null` (inherit) survives as a value and a stray
 * field never reaches the service.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const policy = await serverFetch<CourseReviewAiPolicy>({
      service: 'content',
      path: `/containers/${id}/review-policy`,
    });
    return NextResponse.json(policy);
  } catch (error) {
    return NextResponse.json(
      { error: 'The course review policy could not be read' },
      { status: statusOf(error, 502) },
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { autoAcceptAfterHours?: number | null; teacherReviewTemplates?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'A body is required' }, { status: 400 });
  }

  try {
    const policy = await serverFetch<CourseReviewAiPolicy>({
      service: 'content',
      path: `/containers/${id}/review-policy`,
      method: 'PUT',
      body: {
        autoAcceptAfterHours: body.autoAcceptAfterHours ?? null,
        teacherReviewTemplates: Array.isArray(body.teacherReviewTemplates)
          ? body.teacherReviewTemplates
          : [],
      },
      expectedErrorStatuses: [422],
    });
    return NextResponse.json(policy);
  } catch (error) {
    return NextResponse.json(
      { error: 'The course review policy could not be saved' },
      { status: statusOf(error, 502) },
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
