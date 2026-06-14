import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors/app-error';
import { getInvitationsProvider } from '@/lib/invitations/provider';

/** GET /api/tutoring/invitations */
export async function GET() {
  try {
    const provider = getInvitationsProvider();
    const data = await provider.listTutoring();
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch tutoring invitations' }, { status: 502 });
  }
}
