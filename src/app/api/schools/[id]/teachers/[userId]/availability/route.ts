import { type NextRequest, NextResponse } from 'next/server';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { handleBffError } from '../../../_bff-helpers';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await params;
  try {
    const provider = getSchedulingProvider();
    const data = await provider.getAvailability(userId);
    return NextResponse.json(data);
  } catch (e) {
    return handleBffError(e, 'Failed to fetch availability');
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { userId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    const provider = getSchedulingProvider();
    await provider.putAvailability(userId, body as Parameters<typeof provider.putAvailability>[1]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleBffError(e, 'Failed to update availability');
  }
}
