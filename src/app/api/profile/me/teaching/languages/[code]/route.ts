import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

type Params = { params: Promise<{ code: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { code } = await params;
  try {
    await serverFetch({
      service: 'profile',
      path: `/profiles/me/teaching/languages/${code}`,
      method: 'DELETE',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to remove teaching language' }, { status: 502 });
  }
}
