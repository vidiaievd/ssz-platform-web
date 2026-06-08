import { type NextRequest, NextResponse } from 'next/server';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { handleBffError } from '../../../_bff-helpers';
import type { Absence } from '@/features/teachers/types';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const provider = getSchedulingProvider();
    const all = await provider.listAbsences(id);
    return NextResponse.json(all);
  } catch (e) {
    return handleBffError(e, 'Failed to fetch absences');
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id, userId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    const input = body as Pick<Absence, 'kind' | 'scope' | 'from' | 'to' | 'reason'>;
    const provider = getSchedulingProvider();
    const result = await provider.reportAbsence({ schoolId: id, teacherId: userId, ...input });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleBffError(e, 'Failed to report absence');
  }
}
