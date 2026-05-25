import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

type Params = { params: Promise<{ token: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  try {
    await serverFetch({
      service: 'organization',
      path: `/api/v1/schools/invitations/${token}/accept`,
      method: 'POST',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Invitation not found or expired' }, { status: 404 });
    }
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'Already a member' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 502 });
  }
}
