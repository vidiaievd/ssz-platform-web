import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: 'media',
      path: '/media/uploads/request',
      method: 'POST',
      body,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'validation') {
      // A recording refused before any byte moves — over 8 MB, not audio (plan 70 §3.4).
      const code = refusalCode(e.details);
      return NextResponse.json(
        { error: 'Invalid upload request', ...(code === null ? {} : { code }) },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: 'Failed to request upload' }, { status: 502 });
  }
}

/** media-service puts a domain refusal's code in `message`; validation prose is not a code. */
function refusalCode(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const { message } = details as { message?: unknown };
  return typeof message === 'string' && /^[A-Z][A-Z_]+$/.test(message) ? message : null;
}
