'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import type { UseUnsavedChangesReturn } from '../hooks/use-unsaved-changes';

interface PanelSaveButtonProps {
  unsaved: UseUnsavedChangesReturn;
  /**
   * Button text. Give panels that sit inside a lesson editor their own wording —
   * several plain "Save" buttons on one screen are ambiguous, to the author and
   * to a screen reader alike.
   */
  label?: string;
  /** Toast shown on success. Defaults to the generic lesson wording. */
  successMessage?: string;
  className?: string;
}

/**
 * Save button for the sub-panels that used to reach the server on a debounce.
 * Disabled until something actually changed, so the author can tell at a glance
 * whether the panel holds anything the students have not received yet.
 */
export function PanelSaveButton({
  unsaved,
  label,
  successMessage,
  className,
}: PanelSaveButtonProps) {
  const t = useTranslations('Authoring');

  return (
    <Button
      type="button"
      size="sm"
      className={className}
      disabled={!unsaved.isDirty}
      loading={unsaved.status === 'saving'}
      onClick={() => {
        void (async () => {
          const ok = await unsaved.save();
          if (ok) toast.success(successMessage ?? t('lessons.saveSuccess'));
          else toast.error(t('lessons.saveFailed'));
        })();
      }}
    >
      {label ?? t('form.save')}
    </Button>
  );
}
