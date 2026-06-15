'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { useProfileSettingsForm } from '../hooks/use-profile-settings-form';

export function ProfileSaveBar() {
  const t = useTranslations('Profile');
  const { form, isPending } = useProfileSettingsForm();
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !isPending) {
          document.querySelector<HTMLFormElement>('form[data-profile-form]')?.requestSubmit();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, isPending]);

  return (
    <AnimatePresence>
      {isDirty && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
          className="sticky bottom-0 mt-auto border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3 md:px-8"
        >
          <div className="flex items-center justify-between gap-4 max-w-xl">
            <span className="hidden sm:block text-sm text-(--ssz-text-muted)">{t('unsavedChanges')}</span>
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => form.reset()}
              >
                {t('discard')}
              </Button>
              <Button type="submit" size="sm" loading={isPending}>
                <span className="hidden sm:inline">{t('save')}</span>
                <span className="sm:hidden">{t('saveShort')}</span>
                <kbd className="hidden sm:inline ml-1.5 text-xs opacity-60 font-mono">⌘S</kbd>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
