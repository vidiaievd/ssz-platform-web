'use client';

import { useState, useTransition } from 'react';
import { Upload, Info, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import type { Container } from '@/features/content/types';

import { publishContainerAction } from '../actions/publish-container';
import { authoringKeys } from '../api/keys';
import type { PreflightResult } from '../types';
import { ValidationChecklist } from './validation-checklist';

// ── Release notes field ───────────────────────────────────────────────────────

const NOTES_LIMIT = 500;

interface ReleaseNotesFieldProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

function ReleaseNotesField({ value, onChange, disabled }: ReleaseNotesFieldProps) {
  const t = useTranslations('Authoring.publish');
  const over = value.length > NOTES_LIMIT;
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{t('releaseNotesLabel')}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('releaseNotesPlaceholder')}
        rows={3}
        disabled={disabled}
        className="resize-none"
        maxLength={NOTES_LIMIT + 50}
      />
      <p className={`text-right font-mono text-[11px] ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
        {value.length}/{NOTES_LIMIT}
      </p>
    </div>
  );
}

// ── Visibility notice ─────────────────────────────────────────────────────────

function VisibilityNotice() {
  const t = useTranslations('Authoring.publish');
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold text-foreground">{t('visibilityLabel')}</span>{' '}
        {t('visibilityNotice')}
      </span>
    </div>
  );
}

// ── Dialog body per phase ─────────────────────────────────────────────────────

type DialogPhase = 'form' | 'publishing' | 'failure' | 'stale';

interface DialogBodyProps {
  result: PreflightResult | null | undefined;
  phase: DialogPhase;
  notes: string;
  onNotesChange: (v: string) => void;
  reviewChecked: boolean;
  onReviewChange: (v: boolean) => void;
  failureMessages?: string[];
  isPending: boolean;
}

function DialogBody({
  result,
  phase,
  notes,
  onNotesChange,
  reviewChecked,
  onReviewChange,
  failureMessages,
  isPending,
}: DialogBodyProps) {
  const t = useTranslations('Authoring.publish');

  if (phase === 'failure') {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {t('failure')}
        </div>
        {failureMessages && failureMessages.length > 0 && (
          <ul className="space-y-1 text-sm">
            {failureMessages.map((msg, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                {msg}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (phase === 'stale') {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {t('stale')}
      </div>
    );
  }

  if (!result) return null;

  const isEmpty = result.checks.length === 0;
  const hasBlockers = result.blockerCount > 0;
  const warningsOnly = !hasBlockers && result.warningCount > 0;
  const allPassed = !hasBlockers && result.warningCount === 0 && !isEmpty;

  if (isEmpty) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
        {t('emptyDraft')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hasBlockers && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{t('replacing')}</span>
        </div>
      )}

      <ValidationChecklist checks={result.checks} defaultPassedOpen={allPassed} />

      {!hasBlockers && (
        <>
          <ReleaseNotesField value={notes} onChange={onNotesChange} disabled={isPending} />
          <VisibilityNotice />
          {warningsOnly && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="review-gate"
                checked={reviewChecked}
                onCheckedChange={(v) => onReviewChange(!!v)}
                disabled={isPending}
              />
              <Label htmlFor="review-gate" className="text-sm leading-snug cursor-pointer">
                {t('reviewGate')}
              </Label>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface PublishDialogProps {
  container: Container;
  /** Pre-fetched preflight result (e.g. from the preflight panel). */
  result?: PreflightResult;
  trigger?: React.ReactNode;
}

export function PublishDialog({ container, result, trigger }: PublishDialogProps) {
  const t = useTranslations('Authoring.publish');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<DialogPhase>('form');
  const [notes, setNotes] = useState('');
  const [reviewChecked, setReviewChecked] = useState(false);
  const [failureMessages, setFailureMessages] = useState<string[]>([]);

  const hasBlockers = (result?.blockerCount ?? 0) > 0;
  const warningsOnly = !hasBlockers && (result?.warningCount ?? 0) > 0;
  const isEmpty = (result?.checks.length ?? -1) === 0;
  const notesOver = notes.length > NOTES_LIMIT;

  const canPublish =
    !hasBlockers &&
    !isEmpty &&
    !notesOver &&
    (!warningsOnly || reviewChecked) &&
    phase === 'form';

  function handleOpen() {
    setPhase('form');
    setNotes('');
    setReviewChecked(false);
    setFailureMessages([]);
    setOpen(true);
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
  }

  function handlePublish() {
    if (!canPublish || isPending) return;
    setPhase('publishing');
    startTransition(async () => {
      const res = await publishContainerAction(container.id);
      if (!res.ok) {
        setPhase('failure');
        setFailureMessages([res.error.code]);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.containers() });
      await queryClient.invalidateQueries({ queryKey: authoringKeys.versions(container.id) });
      toast.success(t('success'));
      setOpen(false);
    });
  }

  const defaultTrigger = (
    <Button variant="primary" type="button" onClick={handleOpen}>
      {t('trigger')}
    </Button>
  );

  const triggerEl = trigger
    ? <span onClick={handleOpen}>{trigger}</span>
    : defaultTrigger;

  return (
    <>
      {triggerEl}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Upload className="h-4 w-4 text-primary" aria-hidden />
              </span>
              <DialogTitle>{t('dialogTitle')}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            <DialogBody
              result={result}
              phase={phase}
              notes={notes}
              onNotesChange={setNotes}
              reviewChecked={reviewChecked}
              onReviewChange={setReviewChecked}
              failureMessages={failureMessages}
              isPending={isPending}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={handleClose}
              disabled={isPending}
            >
              {t('cancel')}
            </Button>
            <div>
              {phase === 'stale' && (
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => { setOpen(false); window.location.reload(); }}
                >
                  {t('reload')}
                </Button>
              )}
              {phase === 'failure' && (
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => setPhase('form')}
                >
                  {t('retry')}
                </Button>
              )}
              {(phase === 'form' || phase === 'publishing') && (
                <Button
                  variant="primary"
                  type="button"
                  disabled={!canPublish}
                  loading={isPending}
                  onClick={handlePublish}
                >
                  {isPending ? t('publishing') : t('confirm')}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
