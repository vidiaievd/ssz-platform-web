import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import {
  COVERAGE_FOCUSES,
  COVERAGE_SKILLS,
  type ExerciseAxes,
} from '@/features/content-authoring/types';

const PATH = (id: string) => `/exercises/${id}/skills`;

/** What this exercise trains, and which rung of the chain produced that answer. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const axes = await serverFetch<ExerciseAxes>({ service: 'content', path: PATH(id) });
    return NextResponse.json(axes);
  } catch (error) {
    return NextResponse.json({ error: 'The axes could not be read' }, { status: statusOf(error) });
  }
}

/**
 * Overrule the derivation.
 *
 * Both axes travel together, always: one marker covers the pair (§3.5), so the panel
 * hands back the derived focus unchanged when it only meant to correct the skill. Two
 * empty lists are a legitimate body — "this exercise counts towards nothing" — and are
 * a different act from withdrawing the override, which is the DELETE below.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { skills?: unknown; focus?: unknown };
  try {
    body = (await request.json()) as { skills?: unknown; focus?: unknown };
  } catch {
    return NextResponse.json({ error: 'A body is required' }, { status: 400 });
  }

  // Filtered rather than forwarded: the service rejects an unknown member of either list
  // with a 422 that names no field, and a stale client sending a value the platform has
  // since dropped should lose that value, not the whole save.
  const skills = keep(body.skills, COVERAGE_SKILLS);
  const focus = keep(body.focus, COVERAGE_FOCUSES);

  try {
    const axes = await serverFetch<ExerciseAxes>({
      service: 'content',
      path: PATH(id),
      method: 'PUT',
      body: { skills, focus },
    });
    return NextResponse.json(axes);
  } catch (error) {
    return NextResponse.json({ error: 'The axes could not be saved' }, { status: statusOf(error) });
  }
}

/**
 * Hand the exercise back to the derivation.
 *
 * Answers with the derived axes rather than with nothing: withdrawing an override leaves
 * the exercise training what it always trained, and a panel that blanked here would be
 * claiming otherwise.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const axes = await serverFetch<ExerciseAxes>({
      service: 'content',
      path: PATH(id),
      method: 'DELETE',
    });
    return NextResponse.json(axes);
  } catch (error) {
    return NextResponse.json(
      { error: 'The override could not be withdrawn' },
      { status: statusOf(error) },
    );
  }
}

function keep<T extends string>(values: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set(values);
  return allowed.filter((value) => seen.has(value));
}

function statusOf(error: unknown): number {
  if (!(error instanceof AppError)) return 502;
  if (error.code === 'validation') return 422;
  if (error.code === 'forbidden') return 403;
  if (error.code === 'not_found') return 404;
  if (error.code === 'unauthenticated') return 401;
  return 502;
}
