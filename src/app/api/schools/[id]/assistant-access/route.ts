import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import type { AssistantAccess } from '@/features/school/types/assistant-access';

/**
 * Which students the school's assistant answers on the school's account (plan 83, Q6).
 *
 * A pass-through like `review-policy` beside it. organization-service owns the permission,
 * the plan check and the check that every id is still the school's own; this route only
 * names the two refusals the form tells apart — the plan (`not_entitled`) and a group or
 * student that is no longer there (`invalid_access`).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const access = await serverFetch<AssistantAccess>({
      service: 'organization',
      path: `/schools/${schoolId}/assistant-access`,
    });
    return NextResponse.json(access);
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
    const access = await serverFetch<AssistantAccess>({
      service: 'organization',
      path: `/schools/${schoolId}/assistant-access`,
      method: 'PUT',
      body,
      expectedErrorStatuses: [403, 422],
    });
    return NextResponse.json(access);
  } catch (error) {
    return NextResponse.json(errorBody(error), { status: statusOf(error, 502) });
  }
}

function errorBody(error: unknown): unknown {
  if (error instanceof AppError && error.code === 'validation') {
    return {
      error: upstreamCode(error) === 'INVALID_ASSISTANT_ACCESS' ? 'invalid_access' : 'validation',
    };
  }
  if (error instanceof AppError && error.code === 'forbidden') {
    return { error: upstreamCode(error) === 'FEATURE_NOT_ENTITLED' ? 'not_entitled' : 'Forbidden' };
  }
  return { error: 'The assistant settings could not be read' };
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
