import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors/app-error';
import { getInvitationsProvider } from '@/lib/invitations/provider';

type Params = { params: Promise<{ invitationId: string }> };

/** POST /api/tutoring/invitations/[invitationId]/resend */
export async function POST(_req: Request, { params }: Params) {
  const { invitationId } = await params;
  try {
    const provider = getInvitationsProvider();
    const result = await provider.resendTutoring(invitationId);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 409 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'Invitation not found or already gone' }, { status: 410 });
    }
    if (e instanceof AppError && e.code === 'rate_limited') {
      return NextResponse.json({ error: 'Resend throttled — try again later' }, { status: 429 });
    }
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to resend tutoring invitation' }, { status: 502 });
  }
}
