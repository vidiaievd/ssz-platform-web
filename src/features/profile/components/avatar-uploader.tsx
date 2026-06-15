'use client';

import { useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { AssetPicker } from '@/features/media';
import { useMyProfile } from '../api/use-my-profile';
import { updateAvatarAction } from '../actions/update-avatar';
import { removeAvatarAction } from '../actions/remove-avatar';
import { profileKeys } from '../api/keys';

export function AvatarUploader() {
  const tErrors = useTranslations('Errors');
  const { data: profile } = useMyProfile();
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();

  async function handleUploaded(assetUrl: string) {
    startTransition(async () => {
      const result = await updateAvatarAction(assetUrl);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    });
  }

  async function handleRemoved() {
    startTransition(async () => {
      const result = await removeAvatarAction();
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    });
  }

  return (
    <AssetPicker
      currentUrl={profile?.avatarUrl}
      name={profile?.displayName}
      purpose="avatar"
      onUploaded={handleUploaded}
      onRemoved={handleRemoved}
    />
  );
}
