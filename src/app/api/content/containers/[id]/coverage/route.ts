import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { ContainerCoverage, CoverageVersionScope } from '@/features/content-authoring/types';

const SCOPES: readonly CoverageVersionScope[] = ['draft', 'published', 'both'];

/**
 * What this container trains, and what it never touches.
 *
 * A pass-through: every rule behind the numbers — how a skill is derived, when
 * two versions count as diverging, which remarks a module earns — lives in
 * content-service, and the strip that reads this is a renderer over its output
 * (plan 55 §1.7). Deciding any of it here would mean answering it a second time,
 * differently, the day the mobile app asks the same question.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requested = request.nextUrl.searchParams.get('version');
  // An unrecognised value falls back to the service's own default rather than
  // being forwarded: the query is public, and a typo should draw the draft
  // strip, not a 400 where a strip belongs.
  const version = SCOPES.includes(requested as CoverageVersionScope)
    ? (requested as CoverageVersionScope)
    : 'draft';

  try {
    const coverage = await serverFetch<ContainerCoverage>({
      service: 'content',
      path: `/containers/${id}/coverage`,
      query: { version },
    });
    return NextResponse.json(coverage);
  } catch {
    // No empty report on failure: a strip of zeroes is a claim about the course,
    // and "we could not count" is not that claim.
    return NextResponse.json({ error: 'Failed to compute coverage' }, { status: 502 });
  }
}
