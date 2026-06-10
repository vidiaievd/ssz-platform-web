import { type NextRequest, NextResponse } from 'next/server';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { handleBffError } from '../../_bff-helpers';
import type { CurriculumPlan } from '@/features/teachers/types';

type Params = { params: Promise<{ id: string; groupId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { groupId } = await params;
  try {
    const provider = getSchedulingProvider();
    const data = await provider.getCurriculum(groupId);
    return NextResponse.json(data);
  } catch (e) {
    return handleBffError(e, 'Failed to fetch curriculum');
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { groupId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    const provider = getSchedulingProvider();
    await provider.putCurriculum(groupId, body as CurriculumPlan);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleBffError(e, 'Failed to save curriculum');
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { groupId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  try {
    const provider = getSchedulingProvider();
    const existing = await provider.getCurriculum(groupId);
    const patch = body as {
      unit?: CurriculumPlan['units'][number];
      reorder?: string[];
      override?: { unitId: string; reason: string };
      plan?: CurriculumPlan;
    };

    if (patch.unit) {
      const units = existing.units.map((u) => (u.unitId === patch.unit!.unitId ? patch.unit! : u));
      await provider.putCurriculum(groupId, { ...existing, units });
    } else if (patch.reorder) {
      const unitMap = Object.fromEntries(existing.units.map((u) => [u.unitId, u]));
      const units = patch.reorder.map((id, i) => ({ ...unitMap[id]!, order: i + 1 })).filter(Boolean);
      await provider.putCurriculum(groupId, { ...existing, units });
    } else if (patch.override && patch.plan) {
      const units = existing.units.map((u) =>
        u.unitId === patch.override!.unitId ? { ...u, status: 'overridden' as const } : u,
      );
      await provider.putCurriculum(groupId, { ...patch.plan, units });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleBffError(e, 'Failed to patch curriculum');
  }
}
