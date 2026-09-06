import { MailCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getTutoringInvitations } from '@/features/invitations/api/queries';
import { TutoringInvitationsTableClient } from './tutoring-invitations-client';

export default async function TutoringInvitationsPage() {
  const t = await getTranslations('Invitations.page');
  const invitations = await getTutoringInvitations();
  const pendingCount = invitations.filter((i) => i.status === 'pending').length;

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <MailCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold">{t('title')}</h1>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {pendingCount > 0 ? t('pendingSummary', { count: pendingCount }) : t('noPending')}
        </p>
      </div>

      {/* Role/group columns auto-hidden (all STUDENT, no groups) */}
      <TutoringInvitationsTableClient invitations={invitations} />
    </main>
  );
}
