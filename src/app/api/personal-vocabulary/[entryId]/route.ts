import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';

import { errorResponse, readJson } from '../respond';

type Params = { params: Promise<{ entryId: string }> };

/** Corrects one of my own words or its translation; `translation: ''` removes it. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { entryId } = await params;
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  try {
    const word = await serverFetch({
      service: 'content',
      path: `/personal-vocabulary/${entryId}`,
      method: 'PATCH',
      body,
      expectedErrorStatuses: [404, 409, 422],
    });
    return NextResponse.json(word);
  } catch (e) {
    return errorResponse(e, 'Failed to update the word');
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { entryId } = await params;
  try {
    await serverFetch({
      service: 'content',
      path: `/personal-vocabulary/${entryId}`,
      method: 'DELETE',
      expectedErrorStatuses: [404],
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e, 'Failed to delete the word');
  }
}
