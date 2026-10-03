import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';

import { atomErrorResponse } from '../errors';

type Params = { params: Promise<{ id: string }> };

/**
 * The order the author reads the atoms in. Every living atom has to be named — a subset
 * would leave the atoms left out holding positions the reordered ones are claiming.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as { items?: Array<{ atomId: string; position: number }> };

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items is required' }, { status: 400 });
  }

  try {
    await serverFetch({
      service: 'content',
      path: `/grammar-rules/${id}/atoms/reorder`,
      method: 'POST',
      body: { items: body.items },
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return atomErrorResponse(e, 'Failed to reorder the atoms');
  }
}
