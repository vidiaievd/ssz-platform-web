import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

type Params = { params: Promise<{ token: string }> };

async function tryAccept(path: string) {
  await serverFetch({
    service: 'organization',
    path,
    method: 'POST',
  });
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  try {
    // Try school invitation accept first; fall back to tutoring if not found.
    try {
      await tryAccept(`/schools/invitations/${token}/accept`);
    } catch (schoolErr) {
      if (schoolErr instanceof AppError && schoolErr.code === 'not_found') {
        await tryAccept(`/tutoring/invitations/${token}/accept`);
      } else {
        throw schoolErr;
      }
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    if (e instanceof AppError && e.code === 'gone') {
      return NextResponse.json({ error: 'Invitation expired or revoked' }, { status: 410 });
    }
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'Already a member' }, { status: 409 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Email mismatch' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 502 });
  }
}
