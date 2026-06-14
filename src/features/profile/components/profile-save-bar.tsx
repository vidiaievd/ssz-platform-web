'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { useProfileSettingsForm } from '../hooks/use-profile-settings-form';

export function ProfileSaveBar() {
  const t = useTranslations('Profile');
  const { form, isPending } = useProfileSettingsForm();
  const isDirty = form.formState.isDirty;

  return (
    <AnimatePresence>
      {isDirty && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
          className="sticky bottom-0 mt-auto border-t border-border bg-background/95 backdrop-blur-sm px-6 py-3 md:px-8"
        >
          <div className="flex items-center justify-between gap-4 max-w-xl">
            <span className="text-sm text-(--ssz-text-muted)">{t('unsavedChanges')}</span>
            <div className="flex items-center gap-2 shrink-0">
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
                {t('save')}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
