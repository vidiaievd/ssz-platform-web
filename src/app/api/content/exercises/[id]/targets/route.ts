import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ExerciseTargets } from '@/features/content-authoring/types';

const PATH = (id: string) => `/exercises/${id}/targets`;

/**
 * What each piece of this exercise is about — plan 63, phase 1.
 *
 * Every item of the document comes back, addressed or not: an author has to see which gaps
 * say nothing about themselves, and an item left out would be indistinguishable from one
 * nobody has got to yet.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const targets = await serverFetch<ExerciseTargets>({ service: 'content', path: PATH(id) });
    return NextResponse.json(targets);
  } catch (error) {
    return NextResponse.json(
      { error: 'What this exercise is about could not be read' },
      { status: statusOf(error) },
    );
  }
}

/**
 * Say what one item is about. The body replaces every target of that item — "this gap is
 * about these atoms", not "add one more" — and an empty list clears it.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { itemKey?: unknown; targets?: unknown };
  try {
    body = (await request.json()) as { itemKey?: unknown; targets?: unknown };
  } catch {
    return NextResponse.json({ error: 'A body is required' }, { status: 400 });
  }

  if (!Array.isArray(body.targets)) {
    return NextResponse.json({ error: 'targets is required' }, { status: 400 });
  }

  const targets = body.targets
    .filter((target): target is Record<string, unknown> => typeof target === 'object' && !!target)
    .map((target) => ({
      atomType: String(target.atomType),
      atomId: String(target.atomId),
      role: String(target.role),
    }));

  try {
    await serverFetch({
      service: 'content',
      path: PATH(id),
      method: 'PUT',
      body: {
        itemKey: typeof body.itemKey === 'string' && body.itemKey !== '' ? body.itemKey : null,
        targets,
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: 'What this item is about could not be saved' },
      { status: statusOf(error) },
    );
  }
}

function statusOf(error: unknown): number {
  if (!(error instanceof AppError)) return 502;
  if (error.code === 'unauthenticated') return 401;
  if (error.code === 'forbidden') return 403;
  if (error.code === 'not_found') return 404;
  if (error.code === 'validation') return 422;
  return 502;
}
