import { type NextRequest, NextResponse } from 'next/server';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import type { Slot } from '@/features/groups/types';

type Params = { params: Promise<{ id: string; groupId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { groupId } = await params;
  try {
    const scheduling = getSchedulingProvider();
    const slots = await scheduling.getSlots(groupId);
    return NextResponse.json(slots);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 502 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { groupId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be an array of slots' }, { status: 400 });
  }

  try {
    const scheduling = getSchedulingProvider();
    await scheduling.putSlots(groupId, body as Slot[]);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Failed to update slots' }, { status: 502 });
  }
}
