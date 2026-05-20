'use client';

import { useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';

import { useRouter } from '@/lib/i18n/navigation';
import { Button, type ButtonProps } from '@/components/ui/button';

import { logoutAction } from '../actions/logout';
import { authKeys } from '../api/keys';

type LogoutButtonProps = Omit<ButtonProps, 'onClick' | 'loading'>;

export function LogoutButton({ children, ...props }: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const router = useRouter();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      queryClient.removeQueries({ queryKey: authKeys.me() });
      router.push('/');
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
