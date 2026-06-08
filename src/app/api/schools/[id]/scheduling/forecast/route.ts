import { type NextRequest, NextResponse } from 'next/server';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { handleBffError } from '../../_bff-helpers';
import type { ForecastParams } from '@/features/teachers/types';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    const provider = getSchedulingProvider();
    const result = await provider.computeForecast(id, body as ForecastParams);
    return NextResponse.json(result);
  } catch (e) {
    return handleBffError(e, 'Failed to compute forecast');
  }
}
