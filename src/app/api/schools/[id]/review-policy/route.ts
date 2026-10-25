import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import type { SchoolReviewAiPolicy } from '@/features/review/types/oversight';

/**
 * Who answers this school's work first — the teacher, or a model (plan 80).
 *
 * A pass-through like `review-settings` beside it. organization-service owns the bounds,
 * the permission and the plan check (R7): a mode with a model is refused there when the
 * plan lacks `school.review_ai_policy`, whatever this route or the form decided. The one
 * thing done here is telling that refusal apart from "not an owner", because the form says
 * different things about them.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const policy = await serverFetch<SchoolReviewAiPolicy>({
      service: 'organization',
      path: `/schools/${schoolId}/review-policy`,
    });
    return NextResponse.json(policy);
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
    const policy = await serverFetch<SchoolReviewAiPolicy>({
      service: 'organization',
      path: `/schools/${schoolId}/review-policy`,
      method: 'PUT',
      body,
      expectedErrorStatuses: [403, 422],
    });
    return NextResponse.json(policy);
  } catch (error) {
    return NextResponse.json(errorBody(error), { status: statusOf(error, 502) });
  }
}

/**
 * `not_entitled` — the plan, not the person, is what refused; `validation` carries the
 * service's own message (the auto-accept earlier than the escalation is the usual one).
 */
function errorBody(error: unknown): unknown {
  if (error instanceof AppError && error.code === 'validation') {
    return { error: 'validation', details: error.details };
  }
  if (error instanceof AppError && error.code === 'forbidden') {
    return { error: upstreamCode(error) === 'FEATURE_NOT_ENTITLED' ? 'not_entitled' : 'Forbidden' };
  }
  return { error: 'The review policy could not be read' };
}

function upstreamCode(error: AppError): string | null {
  const details = error.details as { error?: { code?: unknown } } | null | undefined;
  const code = details?.error?.code;
  return typeof code === 'string' ? code : null;
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
