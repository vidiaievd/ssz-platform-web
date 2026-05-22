'use client';

import { useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { Container, GrammarRule } from '@/features/content/types';

import { useAuthoringGrammarRules } from '../api/use-authoring-grammar';
import { authoringKeys } from '../api/keys';
import { createGrammarRuleAction, deleteGrammarRuleAction } from '../actions/grammar';
import { GrammarEditor } from './grammar-editor';

interface GrammarListProps {
  container: Container;
}

function GrammarListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

export function GrammarList({ container }: GrammarListProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GrammarRule | null>(null);

  const { data: rules, isLoading, isError } = useAuthoringGrammarRules(container.id);

  function toggleEditor(ruleId: string) {
    setEditingRuleId((prev) => (prev === ruleId ? null : ruleId));
  }

  function handleAddRule() {
    startTransition(async () => {
      const result = await createGrammarRuleAction(container.id, container.targetLanguage, {
        title: t('grammar.newTitle'),
      });
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.grammarRules(container.id) });
      setEditingRuleId(result.value.id);
    });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      const result = await deleteGrammarRuleAction(target.id, container.id);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.grammarRules(container.id) });
      if (editingRuleId === target.id) setEditingRuleId(null);
      toast.success(t('grammar.deleteSuccess'));
    });
  }

  if (isLoading) return <GrammarListSkeleton />;
  if (isError) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">{t('grammar.loadError')}</p>
    );
  }

  const editingRule = rules?.find((r) => r.id === editingRuleId);

  return (
    <div className="space-y-3">
      {!rules || rules.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">{t('grammar.empty')}</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id}>
              <div className="flex items-center justify-between rounded-md border border-border bg-[var(--ssz-bg-surface)] px-3 py-2">
                <span className="text-sm font-medium">
                  {rule.title || t('grammar.untitled')}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={t('grammar.editAriaLabel')}
                    onClick={() => toggleEditor(rule.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={t('grammar.deleteAriaLabel')}
                    onClick={() => setPendingDelete(rule)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {editingRuleId === rule.id && (
                <GrammarEditor
                  ruleId={rule.id}
                  ruleTitle={editingRule?.title ?? ''}
                  container={container}
                  onClose={() => setEditingRuleId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={handleAddRule}
        disabled={isPending}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        {t('grammar.add')}
      </Button>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('grammar.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('grammar.deleteConfirmDescription', {
                title: pendingDelete?.title || t('grammar.untitled'),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('grammar.deleteCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              {t('grammar.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
