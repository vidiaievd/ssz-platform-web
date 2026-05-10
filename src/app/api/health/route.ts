import { NextResponse } from 'next/server';

import { isAppError } from '@/lib/errors';

export async function GET() {
  try {
    // Until services are wired in Phase 5+, just return a static OK.
    // Later, this will perform a fan-out check against critical services.
    return NextResponse.json({ ok: true, version: '0.0.0' });
  } catch (e) {
    const status = isAppError(e) ? 502 : 500;
    return NextResponse.json({ ok: false }, { status });
  }
}
