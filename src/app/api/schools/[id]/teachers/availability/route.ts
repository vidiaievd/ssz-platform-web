import { type NextRequest, NextResponse } from 'next/server';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { resolveSchoolId } from '@/features/school/api/resolve-school-id';
import type { Slot } from '@/features/groups/types';
import { handleBffError } from '../../_bff-helpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const schoolId = await resolveSchoolId(id);
  if (!schoolId) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 });
  }

  const raw = req.nextUrl.searchParams.get('slots');
  if (!raw) {
    return NextResponse.json({ error: 'slots query param required' }, { status: 400 });
  }
  let slots: unknown;
  try {
    slots = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid slots JSON' }, { status: 400 });
  }
  if (!Array.isArray(slots)) {
    return NextResponse.json({ error: 'slots must be an array' }, { status: 400 });
  }

  try {
    const provider = getSchedulingProvider();
    const data = await provider.teachersAvailability(
      schoolId,
      slots as Array<Pick<Slot, 'day' | 'start' | 'end'>>,
    );
    return NextResponse.json(data);
  } catch (e) {
    return handleBffError(e, 'Failed to fetch teacher availability');
  }
}
