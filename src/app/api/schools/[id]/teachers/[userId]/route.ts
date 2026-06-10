import { type NextRequest, NextResponse } from 'next/server';

import { handleBffError } from '../../_bff-helpers';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, userId } = await params;
  try {
    void id;
    void userId;
    // Stub: fetch teacher detail from org-service
    return NextResponse.json({ status: 'unavailable' });
  } catch (e) {
    return handleBffError(e, 'Failed to fetch teacher');
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, userId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    void id;
    void userId;
    void body;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleBffError(e, 'Failed to update teacher');
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, userId } = await params;
  try {
    void id;
    void userId;
    // Guard: check if teacher is primary of any active group (409 if so)
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleBffError(e, 'Failed to remove teacher');
  }
}
