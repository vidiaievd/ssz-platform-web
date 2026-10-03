import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { WorkspaceRecipeCourses } from '@/features/content-authoring/types';

/** How a workspace's courses use its recipe — the Courses card of plan 65. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const courses = await serverFetch<WorkspaceRecipeCourses>({
      service: 'content',
      path: `/coverage-recipes/workspaces/${id}/courses`,
    });
    return NextResponse.json(courses);
  } catch (error) {
    const status =
      error instanceof AppError && error.code === 'forbidden'
        ? 403
        : error instanceof AppError && error.code === 'unauthenticated'
          ? 401
          : 502;
    return NextResponse.json({ error: 'The courses could not be read' }, { status });
  }
}
