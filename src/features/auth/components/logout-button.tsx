'use client';

import { useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';

import { useRouter } from '@/lib/i18n/navigation';
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
