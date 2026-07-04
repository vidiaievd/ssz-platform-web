'use client';

import { PartyPopper, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useMarkGroupAssignedSeen } from '../api/use-mark-group-assigned-seen';
import type { StudentSchool } from '../types';

interface GroupAssignedBannerProps {
  school: StudentSchool;
}

/**
 * Celebratory banner shown once per group assignment — dismissing it persists
 * `groupAssignedSeenAt` on the membership (server-tracked) so it never comes
 * back after a reload or on another device.
 */
export function GroupAssignedBanner({ school }: GroupAssignedBannerProps) {
  const t = useTranslations('Student.GroupAssignedBanner');
  const { mutate, isPending } = useMarkGroupAssignedSeen();

  if (school.status !== 'active' || !school.groupId || school.groupAssignedSeenAt) return null;

  return (
    <Alert variant="success" icon={<PartyPopper className="size-5" aria-hidden="true" />} className="items-center justify-between">
      <div className="flex flex-1 items-center justify-between gap-3">
        <p>{t('message', { group: school.groupName ?? school.schoolName, school: school.schoolName })}</p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('dismiss')}
          disabled={isPending}
          onClick={() => mutate({ membershipId: school.membershipId, schoolId: school.schoolId })}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </Alert>
  );
}
