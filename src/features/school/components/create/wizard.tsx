'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics/track';
import type { BasicsFormValues } from '../../schemas';
import { useCreateWizardStore } from '../../stores/create-wizard-store';
import { useCreateSchool } from '../../api/use-schools';
import { SchoolBasicsForm } from './basics-form';
import { HelperIllustrationPanel } from './helper-panel';

// ── Discard dialog ─────────────────────────────────────────────────────────────

function DiscardWizardDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('School');
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('create.cancel.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('create.cancel.body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus>{t('create.cancel.dismiss')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('create.cancel.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────────

type CreateSchoolWizardProps = {
  tutorEmail?: string;
};

export function CreateSchoolWizard({ tutorEmail: _ }: CreateSchoolWizardProps) {
  const t = useTranslations('School');
  const router = useRouter();
  const store = useCreateWizardStore();

  // Wait for Zustand persist to rehydrate from localStorage
  const [storeHydrated, setStoreHydrated] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const formId = useId();

  const { basicsDraft, isSaving, setIsSaving, setLastError, reset } = store;
  const { mutateAsync: createSchool } = useCreateSchool();

  useEffect(() => {
    const unsub = useCreateWizardStore.persist.onFinishHydration(() => {
      setStoreHydrated(true);
      track({ name: 'school_create_started' });
    });
    void (async () => {
      if (useCreateWizardStore.persist.hasHydrated()) {
        setStoreHydrated(true);
        track({ name: 'school_create_started' });
      }
    })();
    return unsub;
  }, []);

  // Esc → open discard dialog
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !discardOpen) setDiscardOpen(true);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [discardOpen]);

  const isDirty = Boolean(
    basicsDraft.name.trim() ||
      basicsDraft.description ||
      basicsDraft.logoUrl ||
      basicsDraft.slug ||
      basicsDraft.website ||
      basicsDraft.contactEmail ||
      basicsDraft.city,
  );

  function handleClose() {
    if (isDirty) setDiscardOpen(true);
    else router.push('/school');
  }

  function handleDiscard() {
    reset();
    router.push('/school');
  }

  async function handleBasicsNext(values: BasicsFormValues) {
    setIsSaving(true);
    setLastError(null);
    const body = {
      name: values.name,
      slug: values.slug || undefined,
      description: values.description || undefined,
      avatarUrl: values.logoUrl || undefined,
      website: values.website || undefined,
      contactEmail: values.contactEmail || undefined,
      city: values.city || undefined,
    };
    try {
      const slowToast = setTimeout(
        () => toast.info(t('common.stillWorking'), { id: 'slow-save' }),
        8000,
      );
      const school = await createSchool({ body, idempotencyKey: store.idempotencyKey });
      clearTimeout(slowToast);
      toast.dismiss('slow-save');
      track({ name: 'school_create_succeeded' });
      setIsNavigating(true);
      reset();
      router.push(`/school/${school.slug ?? school.id}/dashboard`);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      const reason = err.status === 409 ? 'name_taken' : 'network';
      track({ name: 'school_create_failed', reason });
      if (err.status === 409) {
        toast.error(t('create.error.nameTaken'));
      } else {
        toast.error(t('create.error.network'), {
          action: { label: t('create.error.retry'), onClick: () => void handleBasicsNext(values) },
        });
      }
      setLastError(err.message ?? 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }

  if (!storeHydrated || isNavigating) {
    return (
      <div
        className={cn(
          'relative mx-auto my-0 md:my-12',
          'bg-surface border border-(--ssz-border-default)',
          'rounded-none md:rounded-(--ssz-radius-xl) shadow-none md:shadow-(--ssz-shadow-md)',
          'max-w-4xl min-h-dvh md:min-h-105',
          'flex items-center justify-center',
        )}
        aria-busy="true"
        aria-label={t('common.loading')}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--ssz-border-default) border-t-(--ssz-color-primary-600)" />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          'relative mx-auto my-0 md:my-12 overflow-hidden',
          'bg-surface border border-(--ssz-border-default)',
          'rounded-none md:rounded-(--ssz-radius-xl) shadow-none md:shadow-(--ssz-shadow-md)',
          'max-w-4xl min-h-dvh md:min-h-0',
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-surface border-b border-(--ssz-border-default)">
          <span className="font-[Lora] font-semibold text-(--ssz-color-primary-600)">SSZ</span>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('common.close')}
            className="rounded-md p-1.5 text-(--ssz-text-muted) hover:text-(--ssz-text-primary) hover:bg-subtle transition-colors"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="grid md:grid-cols-[1.2fr_1fr]">
          {/* Form column */}
          <div className="flex flex-col px-6 md:px-10 py-8">
            <div className="mb-6">
              <h1 className="font-[Lora] text-2xl md:text-3xl leading-tight text-(--ssz-text-primary)">
                {t('create.step.basics.title')}
              </h1>
              <p className="mt-1 text-sm text-(--ssz-text-secondary)">
                {t('create.step.basics.subtitle')}
              </p>
            </div>

            <div role="status" aria-live="polite" className="sr-only">
              {isSaving ? t('common.saving') : ''}
            </div>

            <div className="flex-1">
              <SchoolBasicsForm onSubmit={handleBasicsNext} formId={formId} />
            </div>

            {/* Footer */}
            <div
              className={cn(
                'mt-8 flex justify-end',
                'sticky bottom-0 md:static',
                'bg-(--ssz-bg-surface)/95 md:bg-transparent backdrop-blur md:backdrop-blur-none',
                'border-t border-(--ssz-border-default) md:border-t-0',
                '-mx-6 px-6 md:mx-0 md:px-0 py-4 md:py-0',
                'pb-[env(safe-area-inset-bottom)] md:pb-0',
              )}
            >
              <Button type="submit" form={formId} loading={isSaving} aria-busy={isSaving}>
                {t('create.submit')}
              </Button>
            </div>
          </div>

          <HelperIllustrationPanel />
        </div>
      </div>

      <DiscardWizardDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={handleDiscard}
      />
    </>
  );
}
