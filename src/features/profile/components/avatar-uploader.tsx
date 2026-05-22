'use client';

import { useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';
import { useMyProfile } from '../api/use-my-profile';

export function AvatarUploader() {
  const t = useTranslations('Profile');
  const { data: profile } = useMyProfile();

  return (
    <div className="flex items-center gap-4">
      <Avatar
        src={profile?.avatarUrl ?? undefined}
        name={profile?.displayName}
        size="xl"
      />
      <p className="text-sm text-(--ssz-text-muted)">{t('avatar.placeholder')}</p>
    </div>
  );
}
