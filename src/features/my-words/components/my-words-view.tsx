'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';

import { useDeleteMyWord, useMyWords, useUpdateMyWord } from '../api/hooks';
import type { PersonalWord } from '../types';

type Filter = 'all' | 'pending';

/**
 * The student's own dictionary (plan 75, phase 6): every word added from a text, the ones
 * still waiting for a translation first. A word of one's own can be translated or
 * corrected here; a course word is shown as the course has it.
 */
export function MyWordsView() {
  const t = useTranslations('Learning.myWords');
  const translationLanguage = useLocale();
  const words = useMyWords(translationLanguage);
  const [filter, setFilter] = useState<Filter>('all');
  const [deleting, setDeleting] = useState<PersonalWord | null>(null);
  const remove = useDeleteMyWord();

  if (words.isLoading) {
    return (
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[14px]" />
        ))}
      </div>
    );
  }

  if (words.isError) {
    return (
      <div className="rounded-[14px] border border-(--ssz-border-default) p-6 text-center">
        <p className="font-semibold">{t('loadError')}</p>
        <Button className="mt-3" size="sm" variant="ghost" onClick={() => words.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  const all = words.data ?? [];
  if (all.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-(--ssz-border-default) p-8 text-center">
        <p className="font-semibold">{t('empty')}</p>
        <p className="mt-1 text-sm text-(--ssz-text-secondary)">{t('emptyHint')}</p>
      </div>
    );
  }

  const pending = all.filter((w) => w.status === 'pending');
  // Waiting words lead: they are the ones that need the student.
  const shown =
    filter === 'pending' ? pending : [...pending, ...all.filter((w) => w.status === 'resolved')];

  return (
    <div className="flex flex-col gap-4">
      <Segmented<Filter>
        aria-label={t('filterLabel')}
        size="sm"
        value={filter}
        onValueChange={setFilter}
        options={[
          { value: 'all', label: t('filterAll', { count: all.length }) },
          { value: 'pending', label: t('filterPending', { count: pending.length }) },
        ]}
      />

      {shown.length === 0 ? (
        <p className="text-sm text-(--ssz-text-secondary)">{t('emptyPending')}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((word) => (
            <WordRow
              key={word.entryId}
              word={word}
              translationLanguage={translationLanguage}
              onDelete={() => setDeleting(word)}
            />
          ))}
        </ul>
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle', { word: deleting?.word ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.ownWord ? t('deleteOwn') : t('deleteCourse')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) remove.mutate(deleting);
                setDeleting(null);
              }}
            >
              {t('deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WordRow({
  word,
  translationLanguage,
  onDelete,
}: {
  word: PersonalWord;
  translationLanguage: string;
  onDelete: () => void;
}) {
  const t = useTranslations('Learning.myWords');
  const update = useUpdateMyWord();
  // A waiting word opens with its field; a translated one of the student's own on request.
  const [editing, setEditing] = useState(word.status === 'pending');
  const [value, setValue] = useState(word.translation ?? '');

  function save() {
    const translation = value.trim();
    if (!translation) return;
    update.mutate(
      { entryId: word.entryId, translationLanguage, translation },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <li className="rounded-[14px] border border-(--ssz-border-default) bg-surface px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span lang={word.targetLanguage} className="text-[17px] font-bold">
              {word.word}
            </span>
            {word.partOfSpeech && (
              <span className="text-xs text-(--ssz-text-muted)">{word.partOfSpeech}</span>
            )}
            {!word.ownWord && (
              <span className="rounded-md bg-(--ssz-color-primary-50) px-1.5 py-0.5 text-[11px] font-semibold text-(--ssz-color-primary-600)">
                {t('courseBadge')}
              </span>
            )}
            {word.surfaceForm.toLowerCase() !== word.word.toLowerCase() && (
              <span className="text-xs text-(--ssz-text-muted)">
                {t('inText', { form: word.surfaceForm })}
              </span>
            )}
          </div>

          {!editing && word.translation && <p className="mt-0.5 text-[15px]">{word.translation}</p>}

          <p className="mt-1 text-xs text-(--ssz-text-muted)">
            {word.deck ? t('deck', { title: word.deck.title }) : t('noDeck')}
          </p>

          {word.contextSentence && (
            <p
              lang={word.targetLanguage}
              className="font-reading mt-1 text-sm text-(--ssz-text-muted) italic"
            >
              {word.contextSentence}
            </p>
          )}

          {editing && word.ownWord && (
            <div className="mt-2.5 flex items-center gap-2">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder={t('translationShort')}
                aria-label={`${t('translationShort')}: ${word.word}`}
                disabled={update.isPending}
                className="max-w-xs"
              />
              <Button size="sm" onClick={save} disabled={!value.trim() || update.isPending}>
                {t('saveTranslation')}
              </Button>
              {word.status === 'resolved' && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  {t('cancel')}
                </Button>
              )}
            </div>
          )}
          {update.isError && (
            <p className="mt-1 text-sm text-(--ssz-color-error-600)">{t('saveError')}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {word.ownWord && !editing && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              aria-label={`${t('edit')}: ${word.word}`}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onDelete}
            aria-label={`${t('delete')}: ${word.word}`}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  );
}
