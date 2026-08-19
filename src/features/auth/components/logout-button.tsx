'use client';

import { useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';

import { useRouter } from '@/lib/i18n/navigation';
import { clearProgressOutbox } from '@/features/learning';
import { clearAnswerDrafts } from '@/features/student/exercises/lib/answer-draft';
import { Button, type ButtonProps } from '@/components/ui/button';

import { logoutAction } from '../actions/logout';

type LogoutButtonProps = Omit<ButtonProps, 'loading'>;

export function LogoutButton({ children, onClick, ...props }: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const router = useRouter();

  function handleLogout(e: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(e);
    startTransition(async () => {
      await logoutAction();
      queryClient.clear();
      // Anything still queued belongs to the session that just ended: the server reads
      // the learner from the cookie, so a leftover ping would land on whoever signs in
      // next on this machine (47.0.A).
      clearProgressOutbox();
      // Unsent answers are the learner's own words — the next person to sign in on this
      // machine has no business being handed them (47.0.C).
      clearAnswerDrafts();
      router.push('/');
      router.refresh();
    });
  }

  return (
    <Button onClick={handleLogout} loading={isPending} {...props}>
      {children ?? (
        <>
          <LogOut className="size-4" />
          Sign out
        </>
      )}
    </Button>
  );
}
