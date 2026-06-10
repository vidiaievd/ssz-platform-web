import { type NextRequest, NextResponse } from 'next/server';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { handleBffError } from '../../../../_bff-helpers';

type Params = { params: Promise<{ id: string; requestId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { requestId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    const { substituteTeacherId, override } = body as {
      substituteTeacherId: string;
      override?: boolean;
    };
    if (!substituteTeacherId) {
      return NextResponse.json({ error: 'substituteTeacherId is required' }, { status: 400 });
    }
    const provider = getSchedulingProvider();
    const result = await provider.assignSubstitute(requestId, substituteTeacherId, override);
    if (!result.ok) {
      return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return handleBffError(e, 'Failed to assign substitute');
  }
}
