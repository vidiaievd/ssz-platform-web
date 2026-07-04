import { notFound } from 'next/navigation';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getInvitationsProvider } from '@/lib/invitations/provider';
import { AppError } from '@/lib/errors';
import { InviteCard } from '@/features/invitations/components/invite-card';
import { InviteTerminal } from '@/features/invitations/components/invite-terminal';
import type { TerminalState } from '@/features/invitations/components/invite-terminal';

type Params = { params: Promise<{ token: string; locale: string }> };

export default async function InvitePage({ params }: Params) {
  const { token } = await params;

  const [currentUser, previewResult] = await Promise.all([
    getCurrentUser(),
    fetchPreview(token),
  ]);

  if (previewResult.type === 'error') {
    return <InviteTerminal state={previewResult.state} />;
  }

  const { preview } = previewResult;

  // Terminal states derived from preview status
  const statusToTerminal: Partial<Record<string, TerminalState>> = {
    expired: 'expired',
    revoked: 'revoked',
    accepted: 'accepted',
  };
  const terminalState = statusToTerminal[preview.status];
  if (terminalState) {
    const workspacePath =
      preview.role === 'STUDENT' || !preview.schoolSlug
        ? '/student'
        : `/school/${preview.schoolSlug}`;
    return (
      <InviteTerminal
        state={terminalState}
        workspacePath={currentUser ? workspacePath : undefined}
      />
    );
  }

  // Active pending invitation
  return (
    <InviteCard
      token={token}
      preview={preview}
      currentUser={currentUser}
    />
  );
}

type PreviewResult =
  | { type: 'ok'; preview: Awaited<ReturnType<ReturnType<typeof getInvitationsProvider>['preview']>> }
  | { type: 'error'; state: TerminalState };

async function fetchPreview(token: string): Promise<PreviewResult> {
  try {
    const provider = getInvitationsProvider();
    const preview = await provider.preview(token);
    return { type: 'ok', preview };
  } catch (e) {
    if (e instanceof AppError) {
      if (e.code === 'not_found') return { type: 'error', state: 'invalid' };
      if (e.code === 'gone') return { type: 'error', state: 'expired' };
    }
    return { type: 'error', state: 'error' };
  }
}

export { notFound };
