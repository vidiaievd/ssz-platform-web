'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { removeFromGroup, addToGroup } from '@/features/students/api/mutations';

type Props = {
  schoolId: string;
  groupId: string;
  userId: string;
  groupName: string;
};

export function RemoveFromGroupButton({ schoolId, groupId, userId, groupName }: Props) {
  const t = useTranslations('Students');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      const result = await removeFromGroup(schoolId, groupId, userId);
      if (result.ok) {
        router.refresh();
        toast(t('detail.removedFromGroup', { group: groupName }), {
          action: {
            label: t('common.undo'),
            onClick: async () => {
              await addToGroup(schoolId, groupId, userId);
              router.refresh();
            },
          },
        });
      } else {
        toast.error(t('detail.removeFailed'));
      }
    });
  }

  return (
    <button
      onClick={handleRemove}
      disabled={isPending}
      className="rounded p-1 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
      aria-label={t('detail.removeFromGroupAriaLabel', { group: groupName })}
    >
      <X className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
