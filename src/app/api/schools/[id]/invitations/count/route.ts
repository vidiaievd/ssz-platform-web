import { type NextRequest, NextResponse } from 'next/server';

import { getInvitationsProvider } from '@/lib/invitations/provider';
import { AppError } from '@/lib/errors';
import type { InvitationRole, InvitationStatus } from '@/features/invitations/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') as InvitationStatus | null;
  const role = searchParams.get('role') as InvitationRole | null;

  try {
    const provider = getInvitationsProvider();
    const count = await provider.count(id, {
      status: status ?? undefined,
      role: role ?? undefined,
    });
    return NextResponse.json({ count });
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to count invitations' }, { status: 502 });
  }
}
