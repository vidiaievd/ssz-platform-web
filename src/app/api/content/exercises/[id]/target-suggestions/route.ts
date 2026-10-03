import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { TargetSuggestions } from '@/features/content-authoring/types';

/**
 * What this exercise is probably about, item by item — proposals only, nothing is written.
 *
 * Built from what the catalogue already records: the `PRACTICED_BY` relations and the
 * grammar pools that the seed and the authoring panels have been filling for months. This
 * is the half of phase 1 that decides whether the 569 exercises already in the catalogue
 * ever get addressed, so it is not optional garnish on the panel.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const suggestions = await serverFetch<TargetSuggestions>({
      service: 'content',
      path: `/exercises/${id}/target-suggestions`,
    });
    return NextResponse.json(suggestions);
  } catch (error) {
    if (error instanceof AppError && error.code === 'forbidden') {
      // Suggestions need edit rights; a viewer gets the targets and no proposals rather
      // than a broken panel.
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof AppError && error.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof AppError && error.code === 'not_found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'The suggestions could not be read' }, { status: 502 });
  }
}
