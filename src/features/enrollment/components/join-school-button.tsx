'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useRouter } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import type { LangCode } from '@/features/groups/types';

type Props = {
  schoolSlug: string;
  schoolLanguage?: LangCode;
  className?: string;
};

/**
 * For an already-authenticated student: creates an additive Membership
 * (identity ≠ membership; no re-registration needed).
 */
export function JoinSchoolButton({ schoolSlug, schoolLanguage = 'nb', className }: Props) {
  const t = useTranslations('Enrollment');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleJoin() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/enrollment/memberships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolSlug, source: 'public-apply', language: schoolLanguage }),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          toast.error(data.error ?? t('joinFailed'));
          return;
        }

        toast.success(t('joinedSuccessfully'));
        router.push(`/student/onboarding/${schoolSlug}`);
      } catch {
        toast.error(t('joinFailed'));
      }
    });
  }

  return (
    <Button onClick={handleJoin} disabled={isPending} className={className}>
      {isPending ? t('joining') : t('joinSchool')}
    </Button>
  );
}
