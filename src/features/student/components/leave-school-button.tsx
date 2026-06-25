'use client';

import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useLeaveMembership } from '../api/use-leave-membership';

interface LeaveSchoolButtonProps {
  membershipId: string;
  schoolName: string;
}

/** Confirm-then-leave action for the school detail header — see plan 19 §F2. */
export function LeaveSchoolButton({ membershipId, schoolName }: LeaveSchoolButtonProps) {
  const t = useTranslations('Student.SchoolDetail');
  const { mutate, isPending } = useLeaveMembership();

  function handleConfirm() {
    mutate(membershipId, {
      onError: () => toast.error(t('leaveError')),
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t('leaveAction')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('leaveConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('leaveConfirmDescription', { school: schoolName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('leaveCancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
            {t('leaveConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
