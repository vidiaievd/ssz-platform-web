import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

import { atomErrorResponse } from './errors';

type Params = { params: Promise<{ id: string }> };

/**
 * The atoms of one grammar rule — what the rule is made of, once it is more than one thing
 * (plan 63, phase 0). The builder reads this list to address exercises at it, and the
 * author edits it here while writing the rule.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const data = await serverFetch<unknown>({
      service: 'content',
      path: `/grammar-rules/${id}/atoms`,
    });
    return NextResponse.json(data ?? []);
  } catch (e) {
    return atomErrorResponse(e, 'Failed to fetch the atoms of this rule');
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as {
    key?: string;
    title?: string;
    track?: string;
    description?: string | null;
  };

  if (typeof body.key !== 'string' || body.key.trim() === '') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }
  if (typeof body.title !== 'string' || body.title.trim() === '') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (body.track !== 'lexis' && body.track !== 'grammar') {
    return NextResponse.json({ error: 'track must be lexis or grammar' }, { status: 400 });
  }

  try {
    const data = await serverFetch<{ atomId: string }>({
      service: 'content',
      path: `/grammar-rules/${id}/atoms`,
      method: 'POST',
      body: {
        key: body.key.trim(),
        title: body.title.trim(),
        track: body.track,
        ...(body.description ? { description: body.description } : {}),
      },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    // A key already used inside this rule is the author's mistake to fix, so the message
    // has to survive the proxy rather than becoming a generic failure.
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'key_taken' }, { status: 409 });
    }
    return atomErrorResponse(e, 'Failed to add the atom');
  }
}
