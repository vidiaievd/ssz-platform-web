'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, LogOut, Trash2, Loader2, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Stepper, type StepDef } from '@/components/ui/stepper';
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
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import { createContainerAction, updateContainerAction } from '../actions/container';
import { useCreateWizardStore } from '../stores/create-wizard';
import { WizardStepMetadata } from './wizard-steps/step-metadata';
import { WizardStepStructure } from './wizard-steps/step-structure';
import { WizardStepTeachers } from './wizard-steps/step-teachers';
import { WizardStepVisibility } from './wizard-steps/step-visibility';
import { WizardStepReview } from './wizard-steps/step-review';

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

function stepIndexFromParam(param: string | null): number {
  const n = parseInt(param ?? '1', 10);
  if (isNaN(n) || n < 1 || n > TOTAL_STEPS) return 0;
  return n - 1; // convert to 0-indexed
}

// ── Autosave indicator ────────────────────────────────────────────────────────

function SaveIndicator({ isSaving, savedAt }: { isSaving: boolean; savedAt: Date | null }) {
  const t = useTranslations('Authoring.wizard.shell');
  if (isSaving)
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('saving')}
      </span>
    );
  if (savedAt)
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <Check className="h-3 w-3" />
        {t('saved')}
      </span>
    );
  return null;
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function CreateWizard() {
  const t = useTranslations('Authoring');
  const router = useRouter();
  const searchParams = useSearchParams();

  const store = useCreateWizardStore();
  const [isPending, startTransition] = useTransition();
  const [showDiscard, setShowDiscard] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Sync step from URL
  const stepParam = searchParams.get('step');
  const draftParam = searchParams.get('draft');
  const urlStep = stepIndexFromParam(stepParam);

  // Initialise store step from URL on mount
  useEffect(() => {
    store.setStep(urlStep);
    if (draftParam && !store.draftId) {
      store.setDraftId(draftParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStep = store.step;

  function navigateTo(step: number, draftId?: string) {
    const params = new URLSearchParams();
    params.set('step', String(step + 1));
    const id = draftId ?? store.draftId;
    if (id) params.set('draft', id);
    router.push(`/school/content/new?${params.toString()}`);
    store.setStep(step);
  }

  // ── Persist on next ────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    startTransition(async () => {
      const { metadata, visibility } = store;

      const accessTierMap: Record<string, 'PUBLIC' | 'FREE_WITHIN_SCHOOL' | 'PAID' | 'INVITE_ONLY'> = {
        public_catalog: 'PUBLIC',
        invite_only: 'INVITE_ONLY',
        internal_draft: 'FREE_WITHIN_SCHOOL',
      };

      const payload = {
        title: metadata.title,
        description: metadata.description || undefined,
        type: 'COURSE' as const,
        targetLanguage: metadata.targetLanguage,
        level: (metadata.level || undefined) as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | undefined,
        slug: metadata.slug || undefined,
        accessTier: accessTierMap[visibility.mode] ?? 'INVITE_ONLY',
      };

      const nextStep = currentStep + 1;

      if (!store.draftId) {
        const res = await createContainerAction(payload);
        if (!res.ok) {
          toast.error(t('wizard.shell.saveError'));
          return;
        }
        const newId = res.value.id;
        store.setDraftId(newId);
        store.markSaved();
        const params = new URLSearchParams();
        params.set('step', String(nextStep + 1));
        params.set('draft', newId);
        router.push(`/school/content/new?${params.toString()}`);
        store.setStep(nextStep);
      } else {
        const res = await updateContainerAction(store.draftId, payload);
        if (!res.ok) {
          toast.error(t('wizard.shell.saveError'));
          return;
        }
        store.markSaved();
        navigateTo(nextStep);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, currentStep, t, router]);

  const handleBack = useCallback(() => {
    navigateTo(currentStep - 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, router, store]);

  // ── Save & exit ────────────────────────────────────────────────────────────

  const handleSaveExit = useCallback(() => {
    if (!store.draftId) {
      router.push('/school/content');
      store.reset();
      return;
    }
    startTransition(async () => {
      const { metadata, visibility } = store;
      const accessTierMap: Record<string, 'PUBLIC' | 'FREE_WITHIN_SCHOOL' | 'PAID' | 'INVITE_ONLY'> = {
        public_catalog: 'PUBLIC',
        invite_only: 'INVITE_ONLY',
        internal_draft: 'FREE_WITHIN_SCHOOL',
      };
      await updateContainerAction(store.draftId!, {
        title: metadata.title,
        description: metadata.description || undefined,
        type: 'COURSE' as const,
        targetLanguage: metadata.targetLanguage,
        level: (metadata.level || undefined) as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | undefined,
        slug: metadata.slug || undefined,
        accessTier: accessTierMap[visibility.mode] ?? 'INVITE_ONLY',
      });
      store.reset();
      router.push('/school/content');
    });
  }, [store, router]);

  // ── Discard ────────────────────────────────────────────────────────────────

  const handleDiscard = useCallback(async () => {
    if (store.draftId) {
      setIsDiscarding(true);
      try {
        const res = await fetch(`/api/content/containers/${store.draftId}`, { method: 'DELETE' });
        if (!res.ok) {
          toast.error(t('wizard.shell.discardError'));
          setIsDiscarding(false);
          return;
        }
      } catch {
        toast.error(t('wizard.shell.discardError'));
        setIsDiscarding(false);
        return;
      }
    }
    store.reset();
    router.push('/school/content');
  }, [store, router, t]);

  // ── Steps config ───────────────────────────────────────────────────────────

  const steps: StepDef[] = [
    { id: 'metadata', label: t('wizard.steps.metadata') },
    { id: 'structure', label: t('wizard.steps.structure') },
    { id: 'teachers', label: t('wizard.steps.teachers') },
    { id: 'visibility', label: t('wizard.steps.visibility') },
    { id: 'review', label: t('wizard.steps.review') },
  ];

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  // Step 1 requires title + language
  const canAdvance =
    currentStep === 0
      ? !!store.metadata.title.trim() && !!store.metadata.targetLanguage
      : true;

  return (
    <>
      {/* Discard confirm dialog */}
      <AlertDialog open={showDiscard} onOpenChange={setShowDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wizard.shell.discard.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {store.draftId
                ? t('wizard.shell.discard.bodyWithDraft')
                : t('wizard.shell.discard.body')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('wizard.shell.discard.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              disabled={isDiscarding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDiscarding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('wizard.shell.discard.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="border-b bg-[var(--ssz-bg-surface)] px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <Button variant="ghost" size="sm" className="-ml-2" asChild>
              <Link href="/school/content">
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t('backToContent')}
              </Link>
            </Button>

            <div className="flex-1 px-4">
              <Stepper
                steps={steps}
                currentStep={currentStep}
                onStepClick={(i) => {
                  if (i < currentStep) navigateTo(i);
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <SaveIndicator isSaving={store.isSaving} savedAt={store.savedAt} />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveExit}
                disabled={isPending}
                className="gap-1.5"
              >
                <LogOut className="h-4 w-4" />
                {t('wizard.shell.saveExit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDiscard(true)}
                disabled={isPending}
                className={cn('gap-1.5', 'text-destructive hover:text-destructive')}
              >
                <Trash2 className="h-4 w-4" />
                {t('wizard.shell.discard.title')}
              </Button>
            </div>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl px-6 py-8">
            {currentStep === 0 && <WizardStepMetadata />}
            {currentStep === 1 && <WizardStepStructure />}
            {currentStep === 2 && <WizardStepTeachers />}
            {currentStep === 3 && <WizardStepVisibility />}
            {currentStep === 4 && (
              <WizardStepReview onSaveAsDraft={handleSaveExit} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-[var(--ssz-bg-surface)]/95 backdrop-blur px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={isFirstStep || isPending}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {t('wizard.shell.back')}
            </Button>

            {!isLastStep && (
              <Button
                onClick={handleNext}
                disabled={!canAdvance || isPending}
                loading={isPending}
              >
                {t('wizard.shell.next')}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
