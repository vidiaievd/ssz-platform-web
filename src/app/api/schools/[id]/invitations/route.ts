import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { getInvitationsProvider } from '@/lib/invitations/provider';
import type { InvitationRole, InvitationStatus } from '@/features/invitations/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const role = searchParams.get('role') as InvitationRole | null;
  const status = searchParams.get('status') as InvitationStatus | null;
  const search = searchParams.get('search') ?? undefined;

  try {
    const provider = getInvitationsProvider();
    const data = await provider.list(
      id,
      {
        role: role ?? undefined,
        status: status ?? undefined,
        search,
      },
    );
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 502 });
  }
}

type BackendInvitationResponse = {
  invitationId: string;
  token: string;
  expiresAt: string;
  deliveryStatus: string;
};

type InvitationBody = {
  email?: string;
  kind?: string;
  recipientUserId?: string;
  [key: string]: unknown;
};

type UserLookupResult = { userId: string };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: InvitationBody;
  try {
    body = await request.json() as InvitationBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // When inviting an existing user, resolve their userId so the notification service
  // can deliver an IN_APP notification in addition to the email.
  if (body.kind === 'onboard_existing' && body.email && !body.recipientUserId) {
    try {
      const lookup = await serverFetch<UserLookupResult>({
        service: 'profile',
        path: '/users/lookup',
        query: { email: body.email },
      });
      body = { ...body, recipientUserId: lookup.userId };
    } catch {
      // Non-fatal: proceed without recipientUserId; email will still be sent.
    }
  }

  try {
    const data = await serverFetch<BackendInvitationResponse>({
      service: 'organization',
      path: `/schools/${id}/invitations`,
      method: 'POST',
      body,
    });
    const origin = request.nextUrl.origin;
    const inviteUrl = `${origin}/en/invite/${data.token}`;
    return NextResponse.json(
      { invitationId: data.invitationId, token: data.token, inviteUrl, expiresAt: data.expiresAt, deliveryStatus: data.deliveryStatus },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (e instanceof AppError && e.code === 'validation') {
      return NextResponse.json({ error: 'Invalid invitation data' }, { status: 422 });
    }
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 502 });
  }
}
