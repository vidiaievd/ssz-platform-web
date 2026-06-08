import { type NextRequest, NextResponse } from 'next/server';

import { handleBffError } from '../../../../_bff-helpers';

type Params = { params: Promise<{ id: string; alertId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id, alertId } = await params;
  try {
    void id;
    void alertId;
    // Stub: ack alert in scheduling-service once available
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleBffError(e, 'Failed to acknowledge alert');
  }
}
