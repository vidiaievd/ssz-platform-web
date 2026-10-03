import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { AtomCoverage, AtomCoverageVersionScope } from '@/features/content-authoring/types';

const SCOPES: readonly AtomCoverageVersionScope[] = ['draft', 'published'];

/**
 * What this container teaches, against what it ever asks — plan 63 §4.2.
 *
 * A pass-through, like the coverage route beside it: what counts as "introduced", when an
 * atom is untested and which findings a unit earns are content-service's to decide, and
 * answering any of it here would mean answering it a second time, differently, the day
 * the mobile app asks.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requested = request.nextUrl.searchParams.get('version');
  const version = SCOPES.includes(requested as AtomCoverageVersionScope)
    ? (requested as AtomCoverageVersionScope)
    : 'draft';

  try {
    const coverage = await serverFetch<AtomCoverage>({
      service: 'content',
      path: `/containers/${id}/atom-coverage`,
      query: { version },
    });
    return NextResponse.json(coverage);
  } catch {
    // No empty report on failure. "Nothing is tested here" is a claim about the course,
    // and a request that did not arrive must not be allowed to make it.
    return NextResponse.json({ error: 'Failed to compute atom coverage' }, { status: 502 });
  }
}
