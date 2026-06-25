'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

export type ApplyCtaState =
  | 'apply'          // logged-in student, not yet a member
  | 'pending'        // membership exists with status 'pending'
  | 'onboarding'     // membership in onboarding flow
  | 'active'         // already enrolled
  | 'rejected'       // membership rejected
  | 'invite-only'    // school not open for public apply
  | 'guest';         // not logged in

type Props = {
  state: ApplyCtaState;
  schoolSlug: string;
  membershipId?: string;
  /** Language to join (default: first available language of the school) */
  language?: string;
  locale: string;
};

export function ApplyCta({ state, schoolSlug, membershipId, language = 'nb', locale }: Props) {
  const t = useTranslations('PublicSchool.Cta');
  const router = useRouter();
  const [applying, setApplying] = useState(false);

  if (state === 'invite-only') {
    return (
      <p className="text-sm text-(--ssz-text-muted) italic">{t('inviteOnly')}</p>
    );
  }

  if (state === 'active') {
    return (
      <p className="text-sm font-medium text-green-600">{t('alreadyEnrolled')}</p>
    );
  }

  if (state === 'onboarding' && membershipId) {
    return (
      <Button
        onClick={() =>
          router.push(
            `/${locale}/student/onboarding/${schoolSlug}?membershipId=${membershipId}`,
          )
        }
      >
        {t('continueOnboarding')}
      </Button>
    );
  }

  if (state === 'pending') {
    return (
      <p className="text-sm text-(--ssz-text-muted)">{t('applicationPending')}</p>
    );
  }

  if (state === 'guest') {
    return (
      <Button
        onClick={() =>
          router.push(
            `/${locale}/register/student?school=${schoolSlug}`,
          )
        }
      >
        {t('joinAsGuest')}
      </Button>
    );
  }

  // state === 'apply' or 'rejected' — a rejected membership is terminal, so re-applying submits a fresh one
  async function handleApply() {
    setApplying(true);
    try {
      const res = await fetch('/api/enrollment/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolSlug,
          source: 'public-apply',
          language,
        }),
      });
      if (!res.ok) throw new Error('Apply failed');
      const data = (await res.json()) as { id: string };
      toast.success(t('applicationSent'));
      // Redirect to onboarding if auto-approved to onboarding, otherwise refresh to show pending state
      router.push(
        `/${locale}/student/onboarding/${schoolSlug}?membershipId=${data.id}`,
      );
    } catch {
      toast.error(t('applyFailed'));
      setApplying(false);
    }
  }

  if (state === 'rejected') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{t('applicationRejected')}</p>
        <Button onClick={handleApply} disabled={applying} variant="outline">
          {applying ? t('applying') : t('reapply')}
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleApply} disabled={applying}>
      {applying ? t('applying') : t('apply')}
    </Button>
  );
}
