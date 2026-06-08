import { type NextRequest, NextResponse } from 'next/server';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { handleBffError } from '../../_bff-helpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const provider = getSchedulingProvider();
    const data = await provider.coverQueue(id);
    return NextResponse.json(data);
  } catch (e) {
    return handleBffError(e, 'Failed to fetch cover queue');
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    // Stub: create a substitute request from a lesson ID
    void id;
    void body;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleBffError(e, 'Failed to create substitute request');
  }
}
