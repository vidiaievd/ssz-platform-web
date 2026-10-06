import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;

  try {
    // Upstream returns 204 No Content — there's no asset payload to relay.
    await serverFetch({
      service: 'media',
      path: `/media/uploads/${assetId}/finalize`,
      method: 'POST',
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Refused on ingest — a recording over the ceilings, a file that is not audio (plan 70
    // §3.4). The service's code travels on: «too long» and «try again» are different screens.
    if (e instanceof AppError && e.code === 'validation') {
      const code = refusalCode(e.details);
      return NextResponse.json(
        { error: 'Upload refused', ...(code === null ? {} : { code }) },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: 'Failed to finalize upload' }, { status: 502 });
  }
}

/** media-service puts its refusal code in `message` (`UnprocessableEntityException(code)`). */
function refusalCode(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const { message } = details as { message?: unknown };
  return typeof message === 'string' && /^[A-Z][A-Z_]+$/.test(message) ? message : null;
}
