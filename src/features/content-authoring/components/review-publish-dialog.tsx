'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, Check, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { Container } from '@/features/content/types';

import { collectPublishRows, type PublishRow } from '../lib/publish-rows';
import { useContainersPreflight, type PreflightEntry } from '../api/use-containers-preflight';
import { useCurriculumTree } from '../api/use-curriculum-tree';
import { authoringKeys } from '../api/keys';
import { publishContainerAction } from '../actions/publish-container';
import { PublishStateBadge } from './publish-state-badge';

type RowOutcome = 'idle' | 'publishing' | 'published' | 'failed';

// ── One row ───────────────────────────────────────────────────────────────────

interface RowProps {
  row: PublishRow;
  preflight: PreflightEntry | undefined;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  outcome: RowOutcome;
  errorCode?: string;
  disabled: boolean;
}

function ReviewRow({
  row,
  preflight,
  selected,
  onSelectedChange,
  outcome,
  errorCode,
  disabled,
}: RowProps) {
  const t = useTranslations('Authoring.reviewPublish');
  const tErrors = useTranslations('Errors');

  const isLoading = preflight?.isLoading ?? false;
  const blockerCount = preflight?.result?.blockerCount ?? 0;
  const warningCount = preflight?.result?.warningCount ?? 0;
  const blocked = blockerCount > 0;

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
      <Checkbox
        id={`publish-${row.containerId}`}
        checked={selected}
        onCheckedChange={(v) => onSelectedChange(!!v)}
        disabled={disabled || blocked || outcome === 'published'}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <Label
          htmlFor={`publish-${row.containerId}`}
          className="flex flex-wrap items-center gap-2 text-sm font-semibold"
        >
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {row.kind === 'course' ? t('rowCourse') : t('rowModule')}
          </span>
          <span className="truncate">{row.title}</span>
          <PublishStateBadge state={row.publishState} />
        </Label>

        {isLoading ? (
          <Skeleton className="h-3.5 w-28" />
        ) : blocked ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('rowBlockers', { count: blockerCount })}
          </p>
        ) : warningCount > 0 ? (
          <p className="text-xs text-warning-700">{t('rowWarnings', { count: warningCount })}</p>
        ) : null}

        {outcome === 'published' && (
          <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('rowPublished')}
          </p>
        )}
        {outcome === 'failed' && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {errorCode ? tErrors(errorCode as 'unknown') : t('rowFailed')}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

interface ReviewPublishDialogProps {
  container: Container;
  draftVersionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReviewPublishDialog({
  container,
  draftVersionId,
  open,
  onOpenChange,
}: ReviewPublishDialogProps) {
  const t = useTranslations('Authoring.reviewPublish');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const { data: tree, isLoading } = useCurriculumTree(container.id, draftVersionId);

  const rows = collectPublishRows(tree, container.title);
  // Pre-flight for every row, owned here so the confirm button can refuse a
  // doomed publish without the rows reporting anything back up.
  const preflights = useContainersPreflight(
    rows.map((r) => r.containerId),
    open,
  );

  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [outcomes, setOutcomes] = useState<Record<string, RowOutcome>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isBlocked = (id: string) => (preflights.get(id)?.result?.blockerCount ?? 0) > 0;
  const isSelected = (id: string) => !deselected.has(id) && !isBlocked(id);
  const selectedRows = rows.filter((r) => isSelected(r.containerId));

  function setSelected(id: string, selected: boolean) {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (selected) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePublish() {
    if (selectedRows.length === 0 || isPending) return;
    startTransition(async () => {
      let published = 0;
      // Sequential on purpose: each publish is its own transaction, and a
      // failure halfway must leave the rows before it visibly done.
      for (const row of selectedRows) {
        setOutcomes((prev) => ({ ...prev, [row.containerId]: 'publishing' }));
        const result = await publishContainerAction(row.containerId);
        if (result.ok) {
          published += 1;
          setOutcomes((prev) => ({ ...prev, [row.containerId]: 'published' }));
        } else {
          setOutcomes((prev) => ({ ...prev, [row.containerId]: 'failed' }));
          setErrors((prev) => ({ ...prev, [row.containerId]: result.error.code }));
        }
      }

      await queryClient.invalidateQueries({ queryKey: authoringKeys.containers() });
      if (draftVersionId) {
        await queryClient.invalidateQueries({
          queryKey: authoringKeys.tree(container.id, draftVersionId),
        });
      }
      for (const row of selectedRows) {
        void queryClient.invalidateQueries({ queryKey: authoringKeys.versions(row.containerId) });
        void queryClient.invalidateQueries({ queryKey: authoringKeys.preflight(row.containerId) });
      }

      if (published === selectedRows.length) {
        toast.success(t('summaryAllPublished', { count: published }));
        onOpenChange(false);
      } else {
        toast.error(t('summaryPartial', { published, total: selectedRows.length }));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (isPending ? undefined : onOpenChange(v))}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-4 w-4 text-primary" aria-hidden />
            </span>
            <DialogTitle>{t('title')}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('allPublished')}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t('description')}</p>
              {rows.map((row) => (
                <ReviewRow
                  key={row.containerId}
                  row={row}
                  preflight={preflights.get(row.containerId)}
                  selected={isSelected(row.containerId)}
                  onSelectedChange={(v) => setSelected(row.containerId, v)}
                  outcome={outcomes[row.containerId] ?? 'idle'}
                  errorCode={errors[row.containerId]}
                  disabled={isPending}
                />
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('close')}
          </Button>
          {rows.length > 0 && (
            <Button
              variant="primary"
              type="button"
              disabled={selectedRows.length === 0 || isPending}
              loading={isPending}
              onClick={handlePublish}
            >
              {isPending ? t('publishing') : t('confirm', { count: selectedRows.length })}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
