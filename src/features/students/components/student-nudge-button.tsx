'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { nudgeStudent } from '@/features/students/api/mutations';
import { useTranslations } from 'next-intl';

type Props = {
  schoolId: string;
  userId: string;
  studentName: string;
};

export function StudentNudgeButton({ schoolId, userId, studentName }: Props) {
  const t = useTranslations('Students');
  const [isPending, startTransition] = useTransition();

  function handleNudge() {
    startTransition(async () => {
      const result = await nudgeStudent(schoolId, userId);
      if (result.ok) {
        toast.success(t('detail.nudgeSent', { name: studentName }));
      } else {
        toast.error(t('detail.nudgeFailed'));
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleNudge}
      disabled={isPending}
      aria-label={t('detail.nudgeAriaLabel', { name: studentName })}
    >
      <Bell className="mr-1.5 h-4 w-4" aria-hidden />
      {isPending ? t('detail.nudgeSending') : t('detail.nudge')}
    </Button>
  );
}
