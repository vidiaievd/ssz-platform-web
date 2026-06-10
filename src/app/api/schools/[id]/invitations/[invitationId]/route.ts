import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors/app-error';
import { getInvitationsProvider } from '@/lib/invitations/provider';

type Params = { params: Promise<{ id: string; invitationId: string }> };

/** DELETE /api/schools/[id]/invitations/[invitationId] — revoke */
export async function DELETE(_req: Request, { params }: Params) {
  const { id, invitationId } = await params;
  try {
    const provider = getInvitationsProvider();
    await provider.revoke(id, invitationId);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 409 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Invitation not found or already gone' }, { status: 410 });
    }
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 502 });
  }
}
