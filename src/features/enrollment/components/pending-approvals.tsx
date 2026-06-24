'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ClipboardList } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTransitionMembership } from '@/features/enrollment/api/use-transition-membership';
import type { Membership, MembershipStatus } from '@/features/enrollment/types';

type Props = {
  memberships: Membership[];
};

export function PendingApprovals({ memberships }: Props) {
  const t = useTranslations('Enrollment.Approvals');
  const router = useRouter();
  const transition = useTransitionMembership();
  const [pending, setPending] = useState<Record<string, boolean>>({});

  if (memberships.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <ClipboardList className="h-10 w-10 text-(--ssz-text-muted)" />
        <p className="text-sm text-(--ssz-text-muted)">{t('empty')}</p>
      </div>
    );
  }

  async function handleTransition(m: Membership, to: MembershipStatus) {
    const { id: membershipId, schoolId } = m;
    if (!schoolId) return;
    setPending((prev) => ({ ...prev, [membershipId]: true }));
    try {
      await transition.mutateAsync({ membershipId, schoolId, to });
      toast.success(to === 'onboarding' ? t('accepted') : t('rejected'));
      router.refresh();
    } catch {
      toast.error(t('transitionFailed'));
    } finally {
      setPending((prev) => ({ ...prev, [membershipId]: false }));
    }
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {memberships.map((m) => {
        const isBusy = pending[m.id] ?? false;

        return (
          <div
            key={m.id}
            className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-6"
          >
            {/* Info */}
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-sm font-medium text-(--ssz-text-primary)">{m.id}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-(--ssz-text-muted)">
                  {m.language.toUpperCase()}
                  {m.selfReportedLevel ? ` · ${m.selfReportedLevel}` : ''}
                </span>
                <Badge variant="muted" className="text-xs">
                  {m.source === 'public-apply' ? t('sourcePublic') : m.source}
                </Badge>
                <span className="text-xs text-(--ssz-text-muted)">
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => handleTransition(m, 'rejected')}
              >
                {t('reject')}
              </Button>
              <Button
                size="sm"
                disabled={isBusy}
                onClick={() => handleTransition(m, 'onboarding')}
              >
                {t('accept')}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
