import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import type { AiPrecheckSettings } from '@/features/school/types/ai-precheck';

/**
 * Whether the school lets its learners rehearse with a model before handing in, and how
 * often (plan 84, steps 4 and 8–9).
 *
 * A pass-through like `assistant-access` beside it. organization-service owns the permission
 * and the plan check (turning it on needs `ai.practice`); this route only names the two
 * refusals the form tells apart — the plan (`not_entitled`) and a value out of range
 * (`invalid_settings`).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const schoolId = await resolveSchoolId(id);
  if (!schoolId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const settings = await serverFetch<AiPrecheckSettings>({
      service: 'organization',
      path: `/schools/${schoolId}/ai-precheck`,
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
    const settings = await serverFetch<AiPrecheckSettings>({
      service: 'organization',
      path: `/schools/${schoolId}/ai-precheck`,
      method: 'PUT',
      body,
      expectedErrorStatuses: [403, 422],
    });
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(errorBody(error), { status: statusOf(error, 502) });
  }
}

function errorBody(error: unknown): unknown {
  if (error instanceof AppError && error.code === 'validation') {
    return { error: 'invalid_settings' };
  }
  if (error instanceof AppError && error.code === 'forbidden') {
    return { error: upstreamCode(error) === 'FEATURE_NOT_ENTITLED' ? 'not_entitled' : 'Forbidden' };
  }
  return { error: 'The check settings could not be read' };
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
