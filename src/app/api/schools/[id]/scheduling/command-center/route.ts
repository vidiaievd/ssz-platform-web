import { type NextRequest, NextResponse } from 'next/server';

import { buildCommandCenter } from '@/lib/scheduling/command-center';
import { handleBffError } from '../../_bff-helpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    return NextResponse.json(await buildCommandCenter(id));
  } catch (e) {
    return handleBffError(e, 'Failed to fetch command center');
  }
}
