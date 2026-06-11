import { type NextRequest, NextResponse } from 'next/server';

import { getInvitationsProvider } from '@/lib/invitations/provider';
import { AppError } from '@/lib/errors';

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  try {
    const provider = getInvitationsProvider();
    const preview = await provider.preview(token);
    return NextResponse.json(preview);
  } catch (e) {
    if (e instanceof AppError) {
      if (e.code === 'not_found') {
        return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
      }
      if (e.code === 'gone') {
        return NextResponse.json({ error: 'Invitation expired or revoked' }, { status: 410 });
      }
    }
    return NextResponse.json({ error: 'Failed to load invitation' }, { status: 502 });
  }
}
