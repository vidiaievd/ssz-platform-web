import { type NextRequest, NextResponse } from 'next/server';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { handleBffError } from '../../_bff-helpers';

type Params = { params: Promise<{ id: string }> };

/**
 * Composite BFF endpoint: assembles workload KPIs, teacher load rows,
 * violations, vacancies, and room-load from the scheduling provider.
 * Each widget is fault-tolerant: if the provider is unavailable the
 * endpoint returns { status: 'unavailable' } rather than 502.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const provider = getSchedulingProvider();
    const data = await provider.commandCenter(id);
    return NextResponse.json(data);
  } catch (e) {
    return handleBffError(e, 'Failed to fetch command center');
  }
}
