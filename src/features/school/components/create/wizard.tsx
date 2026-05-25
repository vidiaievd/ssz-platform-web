'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
import type { BasicsFormValues } from '../../schemas';
import { useCreateWizardStore, type WizardStep } from '../../stores/create-wizard-store';
import { useCreateSchool, useUpdateSchool } from '../../api/use-schools';
import { SchoolBasicsForm } from './basics-form';
import { InviteList } from './invite-list';
import { WizardDoneCard } from './done';
import { HelperIllustrationPanel } from './helper-panel';

const STEPS: WizardStep[] = ['basics', 'invite', 'done'];
const STEP_NUMBERS: Record<WizardStep, number> = { basics: 1, invite: 2, done: 3 };

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: WizardStep }) {
  const t = useTranslations('School');
  const currentN = STEP_NUMBERS[current];
  const total = STEPS.filter((s) => s !== 'done').length + 1;

  return (
    <div
      role="progressbar"
      aria-valuenow={currentN}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuetext={t('create.progress.label', { current: currentN, total })}
      className="flex items-center gap-2"
    >
      {STEPS.map((step, i) => {
        const n = i + 1;
        const isActive = step === current;
        const isCompleted = STEP_NUMBERS[current] > n;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                'h-2 w-2 rounded-full transition-colors duration-[var(--ssz-duration-base)]',
                isActive
                  ? 'bg-[var(--ssz-color-primary-600)] scale-125'
                  : isCompleted
                    ? 'bg-[var(--ssz-color-primary-300)]'
                    : 'bg-[var(--ssz-neutral-200)]',
              )}
            />
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'hidden md:block h-px w-12 transition-colors duration-[var(--ssz-duration-base)]',
                  isCompleted ? 'bg-[var(--ssz-color-primary-300)]' : 'bg-[var(--ssz-border-default)]',
                )}
              />
            )}
          </div>
        );
      })}
      <span className="ml-1 text-xs text-(--ssz-text-muted)">
        {t('create.progress.label', { current: currentN, total })}
      </span>
    </div>
  );
}

// ── Discard dialog ─────────────────────────────────────────────────────────────

function DiscardWizardDialog({
  open,
  onOpenChange,
  hasSchool,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hasSchool: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations('School');
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('create.cancel.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasSchool ? t('create.cancel.bodyWithSchool') : t('create.cancel.body')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus>{t('create.cancel.dismiss')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={!hasSchool ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {hasSchool ? t('create.cancel.leaveForNow') : t('create.cancel.confirm')}
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

export function CreateSchoolWizard({ tutorEmail }: CreateSchoolWizardProps) {
  const t = useTranslations('School');
  const router = useRouter();
  const store = useCreateWizardStore();

  const [discardOpen, setDiscardOpen] = useState(false);
  const [invitedCount, setInvitedCount] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formId = useId();

  const { step, schoolId, basicsDraft, isSaving, setStep, setSchoolId, setIsSaving, setLastError, reset } = store;

  const { mutateAsync: createSchool } = useCreateSchool();
  const { mutateAsync: updateSchool } = useUpdateSchool(schoolId ?? '');

  // Focus heading on step change
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  // Esc → open discard dialog
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !discardOpen) setDiscardOpen(true);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [discardOpen]);

  const isDirty = Boolean(basicsDraft.name.trim() || basicsDraft.description || basicsDraft.logoUrl);

  function handleClose() {
    if (isDirty || schoolId) {
      setDiscardOpen(true);
    } else {
      router.push('/school/dashboard');
    }
  }

  function handleDiscard() {
    if (!schoolId) reset();
    router.push('/school/dashboard');
  }

  async function handleBasicsNext(values: BasicsFormValues) {
    setIsSaving(true);
    setLastError(null);
    const body = {
      name: values.name,
      description: values.description || undefined,
      avatarUrl: values.logoUrl || undefined,
    };
    try {
      if (!schoolId) {
        // First time — create
        const slowToast = setTimeout(
          () => toast.info(t('common.stillWorking'), { id: 'slow-save' }),
          8000,
        );
        const school = await createSchool({ body, idempotencyKey: store.idempotencyKey });
        clearTimeout(slowToast);
        toast.dismiss('slow-save');
        setSchoolId(school.id);
        setStep('invite');
        router.replace(`/school/new?step=invite&id=${school.id}`);
      } else {
        // Returning from Back — patch
        await updateSchool(body);
        setStep('invite');
        router.replace(`/school/new?step=invite&id=${schoolId}`);
      }
    } catch (e) {
      const err = e as { status?: number; message?: string };
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

  function handleInvitesDone(count: number) {
    setInvitedCount(count);
    setStep('done');
    router.replace(`/school/new?step=done&id=${schoolId}`);
  }

  function handleBack() {
    if (step === 'invite') {
      setStep('basics');
      router.replace(`/school/new?step=basics${schoolId ? `&id=${schoolId}` : ''}`);
    }
  }

  const stepTitles: Record<WizardStep, string> = {
    basics: t('create.step.basics.title'),
    invite: t('create.step.invite.title'),
    done: t('create.step.done.title'),
  };
  const stepSubtitles: Record<WizardStep, string> = {
    basics: t('create.step.basics.subtitle'),
    invite: t('create.step.invite.subtitle'),
    done: t('create.step.done.subtitle'),
  };

  const isDoneStep = step === 'done';

  return (
    <>
      {/* Wizard card */}
      <div
        className={cn(
          'relative mx-auto my-0 md:my-12 overflow-hidden',
          'bg-[var(--ssz-bg-surface)] border border-(--ssz-border-default)',
          'rounded-none md:rounded-[var(--ssz-radius-xl)] shadow-none md:shadow-[var(--ssz-shadow-md)]',
          'max-w-4xl min-h-dvh md:min-h-0',
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-[var(--ssz-bg-surface)] border-b border-(--ssz-border-default)">
          <div className="flex items-center gap-4">
            <span className="font-[Lora] font-semibold text-[var(--ssz-color-primary-600)]">SSZ</span>
            {!isDoneStep && <StepIndicator current={step} />}
          </div>
          {!isDoneStep && (
            <button
              type="button"
              onClick={handleClose}
              aria-label={t('common.close')}
              className="rounded-md p-1.5 text-(--ssz-text-muted) hover:text-(--ssz-text-primary) hover:bg-(--ssz-bg-subtle) transition-colors"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>

        {/* Body */}
        {isDoneStep ? (
          <div className="px-6 py-8">
            <WizardDoneCard
              schoolId={schoolId ?? ''}
              schoolName={basicsDraft.name}
              invitedCount={invitedCount}
            />
          </div>
        ) : (
          <div className="grid md:grid-cols-[1.2fr_1fr]">
            {/* Form column */}
            <div className="flex flex-col px-6 md:px-10 py-8">
              <div className="mb-6">
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-[Lora] text-2xl md:text-3xl leading-[1.25] text-(--ssz-text-primary) focus-visible:outline-none"
                >
                  {stepTitles[step]}
                </h1>
                <p className="mt-1 text-sm text-(--ssz-text-secondary)">{stepSubtitles[step]}</p>
              </div>

              {/* SR save status */}
              <div role="status" aria-live="polite" className="sr-only">
                {isSaving ? t('common.saving') : ''}
              </div>

              <div className="flex-1">
                {step === 'basics' && (
                  <SchoolBasicsForm onSubmit={handleBasicsNext} formId={formId} />
                )}
                {step === 'invite' && schoolId && (
                  <InviteList
                    schoolId={schoolId}
                    tutorEmail={tutorEmail}
                    onDone={handleInvitesDone}
                    formId={formId}
                  />
                )}
              </div>

              {/* Footer */}
              <div
                className={cn(
                  'mt-8 flex items-center justify-between gap-4',
                  'sticky bottom-0 md:static',
                  'bg-[var(--ssz-bg-surface)]/95 md:bg-transparent backdrop-blur md:backdrop-blur-none',
                  'border-t border-(--ssz-border-default) md:border-t-0',
                  '-mx-6 px-6 md:mx-0 md:px-0 py-4 md:py-0',
                  'pb-[env(safe-area-inset-bottom)] md:pb-0',
                )}
              >
                {step === 'invite' ? (
                  <Button type="button" variant="ghost" onClick={handleBack}>
                    {t('create.back')}
                  </Button>
                ) : (
                  <span />
                )}

                <Button
                  type="submit"
                  form={formId}
                  disabled={isSaving}
                >
                  {step === 'invite' ? t('create.next') : t('create.next')}
                </Button>
              </div>
            </div>

            {/* Helper panel */}
            <HelperIllustrationPanel step={step} />
          </div>
        )}
      </div>

      <DiscardWizardDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        hasSchool={Boolean(schoolId)}
        onConfirm={handleDiscard}
      />
    </>
  );
}
