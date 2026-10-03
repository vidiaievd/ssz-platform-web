import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { WorkspaceCoverageRecipe } from '@/features/content-authoring/types';

/**
 * A workspace's lesson recipe — the standard its courses inherit (plan 65).
 *
 * `coverage-recipes/workspaces/:id` because `/workspaces` belongs to organization-service
 * at the gateway. content-service checks the role and the rules against the kernel's
 * vocabulary; a recipe it refuses comes back as 422, a role it refuses as 403, and the
 * page turns read-only on the latter.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const recipe = await serverFetch<WorkspaceCoverageRecipe>({
      service: 'content',
      path: `/coverage-recipes/workspaces/${id}`,
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
  // A workspace has no "inherit" to fall back to, so there is no null to send: a recipe of
  // no rules is how it stops checking.
  if (typeof body.recipe !== 'object' || body.recipe === null) {
    return NextResponse.json({ error: 'recipe is required' }, { status: 400 });
  }

  try {
    const recipe = await serverFetch<WorkspaceCoverageRecipe>({
      service: 'content',
      path: `/coverage-recipes/workspaces/${id}`,
      method: 'PUT',
      body: { recipe: body.recipe },
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
