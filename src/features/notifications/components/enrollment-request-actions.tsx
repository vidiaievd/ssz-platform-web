'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useTransitionMembership } from '@/features/enrollment/api/use-transition-membership';
import type { EnrollmentRequestData } from '../types';

export interface EnrollmentRequestActionsProps {
  data: EnrollmentRequestData;
  applicantHref: string | undefined;
  onResolved: () => void;
}

export function EnrollmentRequestActions({
  data,
  applicantHref,
  onResolved,
}: EnrollmentRequestActionsProps) {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const transition = useTransitionMembership();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  async function handle(to: 'onboarding' | 'rejected', kind: 'approve' | 'reject') {
    setBusy(kind);
    try {
      await transition.mutateAsync({ membershipId: data.membershipId, schoolId: data.schoolId, to });
      onResolved();
      toast.success(t('toasts.markedRead'));
    } catch {
      toast.error(t('toasts.actionFailed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        disabled={busy !== null}
        onClick={() => handle('rejected', 'reject')}
      >
        {t('actions.reject')}
      </Button>
      <Button size="sm" disabled={busy !== null} onClick={() => handle('onboarding', 'approve')}>
        {t('actions.approve')}
      </Button>
      {applicantHref && (
        <Button variant="ghost" size="sm" onClick={() => router.push(applicantHref)}>
          {t('actions.viewApplicant')}
        </Button>
      )}
    </div>
  );
}
