import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { ExpandedModule, ModuleProgress, UnitPayload } from '@/features/learning/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> },
) {
  const { moduleId } = await params;

  try {
    const [module, progress] = await Promise.all([
      serverFetch<ExpandedModule>({
        service: 'content',
        path: `/internal/modules/${moduleId}/expanded`,
      }),
      serverFetch<ModuleProgress>({
        service: 'progress',
        path: `/progress/modules/${moduleId}`,
      }),
    ]);

    const payload: UnitPayload = { module, progress };
    return NextResponse.json(payload);
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (e.code === 'not_found') return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load unit' }, { status: 502 });
  }
}
