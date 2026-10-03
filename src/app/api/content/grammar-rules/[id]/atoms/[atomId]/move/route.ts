import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

import { atomErrorResponse } from '../../errors';

type Params = { params: Promise<{ id: string; atomId: string }> };

/**
 * Move an atom under another rule — the operation every restructure is built from: a rule
 * is split by creating one and moving atoms across, and two are merged by moving all of
 * them one way. Nothing a learner owns travels with it, because a card addresses the atom
 * by id rather than through its rule.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id, atomId } = await params;
  const body = (await request.json()) as { targetRuleId?: string; key?: string };

  if (typeof body.targetRuleId !== 'string' || body.targetRuleId === '') {
    return NextResponse.json({ error: 'targetRuleId is required' }, { status: 400 });
  }

  try {
    await serverFetch({
      service: 'content',
      path: `/grammar-rules/${id}/atoms/${atomId}/move`,
      method: 'POST',
      body: {
        targetRuleId: body.targetRuleId,
        ...(body.key ? { key: body.key } : {}),
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    // The destination already holds a living atom under this key — the ordinary case when
    // two rules are merged, and the author has to supply a new one.
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'key_taken' }, { status: 409 });
    }
    return atomErrorResponse(e, 'Failed to move the atom');
  }
}
