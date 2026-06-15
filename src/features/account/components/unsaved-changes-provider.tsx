'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UnsavedChangesContext } from '@/hooks/use-unsaved-changes';

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Account.unsavedChanges');
  const [isDirty, setDirty] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingNav = useRef<(() => void) | null>(null);

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (isDirty) e.preventDefault();
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const guard = useCallback(
    (proceed: () => void) => {
      if (!isDirty) {
        proceed();
        return;
      }
      pendingNav.current = proceed;
      setDialogOpen(true);
    },
    [isDirty],
  );

  function handleLeave() {
    setDirty(false);
    pendingNav.current?.();
    pendingNav.current = null;
    setDialogOpen(false);
  }

  function handleStay() {
    pendingNav.current = null;
    setDialogOpen(false);
  }

  return (
    <UnsavedChangesContext.Provider value={{ isDirty, setDirty, guard }}>
      {children}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStay}>{t('stay')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave}>{t('leave')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  );
}

