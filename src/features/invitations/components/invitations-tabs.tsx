'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { InvitationAudience, Invitation } from '@/features/invitations/types';

type Props = {
  invitations: Invitation[];
  allowedAudiences?: InvitationAudience[];
};

function countPending(invitations: Invitation[], audience: InvitationAudience): number {
  return invitations.filter((inv) => {
    if (inv.status !== 'pending') return false;
    if (audience === 'all') return true;
    if (audience === 'teachers') return inv.role === 'TEACHER';
    if (audience === 'students') return inv.role === 'STUDENT';
    if (audience === 'staff') {
      return inv.role === 'ADMIN' || inv.role === 'CONTENT_ADMIN' || inv.role === 'SCHEDULER';
    }
    return false;
  }).length;
}

export function InvitationsTabs({
  invitations,
  allowedAudiences,
}: Props) {
  const t = useTranslations('Invitations.tabs');
  const tA11y = useTranslations('Invitations.a11y');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentAudience = (searchParams.get('audience') as InvitationAudience | null) ?? 'all';

  const audienceOptions: { value: InvitationAudience; label: string }[] = [
    { value: 'all', label: t('all') },
    { value: 'teachers', label: t('teachers') },
    { value: 'students', label: t('students') },
    { value: 'staff', label: t('staff') },
  ];

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all') {
        params.delete('audience');
      } else {
        params.set('audience', value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const visibleOptions = allowedAudiences
    ? audienceOptions.filter((o) => allowedAudiences.includes(o.value))
    : audienceOptions;

  return (
    <Tabs value={currentAudience} onValueChange={handleChange}>
      <TabsList>
        {visibleOptions.map(({ value, label }) => {
          const pendingCount = countPending(invitations, value);
          return (
            <TabsTrigger key={value} value={value}>
              {label}
              {pendingCount > 0 && (
                <span
                  className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-medium text-primary"
                  aria-label={tA11y('pendingLabel', { count: pendingCount })}
                >
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
