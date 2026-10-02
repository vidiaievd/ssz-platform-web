import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { CourseCoverageRecipe } from '@/features/content-authoring/types';

/**
 * A course's own lesson recipe, and its workspace's behind it (plan 64, phase 10).
 *
 * content-service resolves the inheritance and validates the rules against the kernel's
 * vocabulary, so this route neither computes nor checks either — a rule the service
 * refuses comes back as 422 for the editor to say so.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const recipe = await serverFetch<CourseCoverageRecipe>({
      service: 'content',
      path: `/containers/${id}/coverage-recipe`,
    });
    return NextResponse.json(recipe);
  } catch (error) {
    return NextResponse.json(
      { error: 'The recipe could not be read' },
      { status: statusOf(error, 502) },
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { recipe?: unknown };
  try {
    body = (await request.json()) as { recipe?: unknown };
  } catch {
    return NextResponse.json({ error: 'A body is required' }, { status: 400 });
  }
  // Absent is not null: null hands the recipe back to the workspace, and a request that
  // forgot the field must not do that by accident.
  if (!('recipe' in body)) {
    return NextResponse.json({ error: 'recipe is required' }, { status: 400 });
  }

  try {
    const recipe = await serverFetch<CourseCoverageRecipe>({
      service: 'content',
      path: `/containers/${id}/coverage-recipe`,
      method: 'PUT',
      body: { recipe: body.recipe ?? null },
    });
    return NextResponse.json(recipe);
  } catch (error) {
    return NextResponse.json(
      { error: 'The recipe could not be saved' },
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
