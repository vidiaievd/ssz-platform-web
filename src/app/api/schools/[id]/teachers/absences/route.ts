import { type NextRequest, NextResponse } from 'next/server';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { handleBffError } from '../../_bff-helpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const provider = getSchedulingProvider();
    const data = await provider.listAbsences(id);
    return NextResponse.json(data);
  } catch (e) {
    return handleBffError(e, 'Failed to fetch absences');
  }
}
