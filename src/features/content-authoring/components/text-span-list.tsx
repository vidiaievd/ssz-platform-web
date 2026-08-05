'use client';

import { useState, useTransition } from 'react';
import { Pencil, Trash2, Unlink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Container, LessonSpanKind, LessonTextSpan } from '@/features/content/types';

import { deleteTextSpanAction, updateTextSpanAction } from '../actions/lesson-spans';
import { useLessonTextSpans } from '../api/use-authoring-lessons';
import { useAuthoringVocabularyLists, useAuthoringVocabularyItems } from '../api/use-authoring-vocabulary';
import type { LevelGrammarRule } from '../lib/level-grammar-rules';
import { authoringKeys } from '../api/keys';

const KIND_LABEL = {
  vocab: 'spans.kindVocab',
  grammar: 'spans.kindGrammar',
  chunk: 'spans.kindChunk',
} as const satisfies Record<LessonSpanKind, string>;

interface TextSpanListProps {
  lessonId: string;
  variantId: string | undefined;
  container: Container;
  /** Grammar rules of this module's Leksjon — what names a grammar span's referent here. */
  grammarRules?: LevelGrammarRule[];
}

/**
 * The annotations already on this variant's body, under the anchor-text field.
 *
 * Broken ones are listed separately rather than hidden: the reader never sees
 * them, so without this panel an annotation that lost its anchor would simply
 * stop working with nothing to show for it. The stored snapshot is often the
 * only surviving record of what the author meant, which is also why nothing
 * here deletes a broken span on the author's behalf.
 */
export function TextSpanList({
  lessonId,
  variantId,
  container,
  grammarRules = [],
}: TextSpanListProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ span: LessonTextSpan; note: string } | null>(null);

  const { data: spans } = useLessonTextSpans(lessonId, variantId);
  const { data: lists } = useAuthoringVocabularyLists(container.id);
  const list = lists?.[0];
  const { data: itemsPage } = useAuthoringVocabularyItems(list?.id ?? '', 1, !!list);


  const all = spans ?? [];
  const intact = all.filter((s) => !s.broken);
  const broken = all.filter((s) => s.broken);

  function referentOf(span: LessonTextSpan) {
    if (span.kind === 'vocab') {
      return (itemsPage?.items ?? []).find((i) => i.id === span.refId)?.lemma ?? null;
    }
    if (span.kind === 'grammar') {
      return grammarRules.find((r) => r.id === span.refId)?.title ?? null;
    }
    return span.note;
  }

  async function refresh() {
    if (!variantId) return;
    await queryClient.invalidateQueries({
      queryKey: authoringKeys.lessonTextSpans(lessonId, variantId),
    });
  }

  function handleDelete(span: LessonTextSpan) {
    if (!variantId) return;
    setBusyId(span.id);
    startTransition(async () => {
      const result = await deleteTextSpanAction(lessonId, variantId, span.id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      toast.success(t('spans.deleted'));
      await refresh();
    });
  }

  /**
   * Repairs a broken span from its single re-anchor candidate. Offered only when
   * there is exactly one: a snapshot occurring twice would rebind to whichever
   * came first, which is the class of error spans exist to eliminate.
   */
  function handleReanchor(span: LessonTextSpan) {
    const candidate = span.reanchorCandidates[0];
    if (!variantId || !candidate || span.reanchorCandidates.length !== 1) return;

    setBusyId(span.id);
    startTransition(async () => {
      const result = await updateTextSpanAction(lessonId, variantId, span.id, candidate);
      setBusyId(null);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      toast.success(t('spans.reanchored'));
      await refresh();
    });
  }

  /**
   * Saves the note. Only the note is editable: `kind` and `refId` are immutable
   * by design (spec 16 §6.3) so the glossary-mark sync keeps one write path, and
   * moving a span is done by re-selecting the text, which is the same gesture as
   * creating one. An emptied field clears the note — the service trims and
   * treats blank as null.
   */
  function handleSaveNote() {
    const target = editing;
    if (!variantId || !target) return;

    setBusyId(target.span.id);
    startTransition(async () => {
      const result = await updateTextSpanAction(lessonId, variantId, target.span.id, {
        note: target.note.trim() || null,
      });
      setBusyId(null);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      setEditing(null);
      toast.success(t('spans.noteSaved'));
      await refresh();
    });
  }

  if (!variantId || all.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-3">
      {intact.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">
            {t('spans.caption', { count: intact.length })}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {intact.map((span) => {
              const referent = referentOf(span);
              return (
                <li key={span.id}>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-(--ssz-border-default) py-0.5 pl-2 pr-0.5 text-xs">
                    <Badge variant="muted">{t(KIND_LABEL[span.kind])}</Badge>
                    <span className="font-reading">{span.textSnapshot}</span>
                    {referent && (
                      <span className="text-(--ssz-text-secondary)">— {referent}</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="size-6 p-0"
                      aria-label={t('spans.editNote', { text: span.textSnapshot })}
                      disabled={isPending && busyId === span.id}
                      onClick={() => setEditing({ span, note: span.note ?? '' })}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="size-6 p-0"
                      aria-label={t('spans.delete', { text: span.textSnapshot })}
                      disabled={isPending && busyId === span.id}
                      onClick={() => handleDelete(span)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {broken.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-(--ssz-border-default) bg-(--ssz-bg-subtle) p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Unlink className="size-3.5" aria-hidden />
            {t('spans.brokenTitle', { count: broken.length })}
          </p>
          <p className="text-xs text-muted-foreground">{t('spans.brokenBody')}</p>
          <ul className="flex flex-col gap-1.5">
            {broken.map((span) => (
              <li key={span.id} className="flex items-center gap-2 text-xs">
                <Badge variant="muted">{t(KIND_LABEL[span.kind])}</Badge>
                <span className="font-reading">{span.textSnapshot}</span>
                {span.brokenReason === 'ref' ? (
                  <span className="text-muted-foreground">{t('spans.brokenRef')}</span>
                ) : span.reanchorCandidates.length === 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={isPending && busyId === span.id}
                    onClick={() => handleReanchor(span)}
                  >
                    {t('spans.reanchor')}
                  </Button>
                ) : (
                  <span className="text-muted-foreground">
                    {span.reanchorCandidates.length === 0
                      ? t('spans.reanchorGone')
                      : t('spans.reanchorAmbiguous')}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="size-6 p-0"
                  aria-label={t('spans.delete', { text: span.textSnapshot })}
                  disabled={isPending && busyId === span.id}
                  onClick={() => handleDelete(span)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('spans.editNoteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('spans.selected', { text: editing?.span.textSnapshot ?? '' })}
          </p>
          <Field label={t('spans.noteLabel')} htmlFor="span-note-edit">
            <Input
              id="span-note-edit"
              value={editing?.note ?? ''}
              onChange={(e) =>
                setEditing((prev) => (prev ? { ...prev, note: e.target.value } : prev))
              }
              placeholder={t('spans.notePlaceholder')}
              maxLength={500}
            />
          </Field>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>
              {t('lessons.deleteCancel')}
            </Button>
            <Button type="button" onClick={handleSaveNote} disabled={isPending} loading={isPending}>
              {t('spans.noteSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
