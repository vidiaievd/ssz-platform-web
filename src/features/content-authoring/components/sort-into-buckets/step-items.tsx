'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import {
  balance,
  buckets,
  issues,
  parseBulk,
  readyItems,
  stepState,
  type Issue,
  type SortIntoBucketsContent,
} from '@/lib/shared-kernel/sort-into-buckets';

import { ReorderWithAnnouncer } from '../lesson-reorder';
import {
  addItem,
  applyBulkPaste,
  assignBucket,
  removeItem,
  reorderItems,
  setItem,
  toggleAlso,
} from './edits';
import { useIssueCopy } from './issue-copy';

const READING = 'var(--ssz-font-reading)';

export interface StepItemsProps<T extends SortIntoBucketsContent> {
  exercise: T;
  onChange: (next: T) => void;
}

/**
 * Step 2: the items, and the bucket each one belongs in — where an author spends most of
 * their time.
 *
 * The bucket is chosen on the row as the item is written, one pill per bucket, because the
 * key is the point of the type and a key written on another screen is written twice. Click a
 * pill to assign, click it again to take it back (AC-I1).
 *
 * The balance meter is here and not in the gate for the reason `multiple_choice_group`'s
 * strip is: a lopsided key is this type's failure mode, and seeing a bar fill up on one side
 * while writing is what stops it being discovered at the end. It reads the kernel's `balance`
 * and the kernel's issues — the amber and the red outline are the `SB_SKEWED` and
 * `SB_BUCKET_EMPTY` findings drawn, not a second opinion about the same thing.
 *
 * What is **not** here yet: the per-item audio row of the disclosure. It belongs to the
 * audio layer and arrives with it (plan 66 phase 7).
 */
export function StepItems<T extends SortIntoBucketsContent>({
  exercise,
  onChange,
}: StepItemsProps<T>) {
  const t = useTranslations('Authoring.sortIntoBuckets');
  const describeIssue = useIssueCopy(exercise);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const shown = buckets(exercise);
  const spread = balance(exercise);
  const ready = readyItems(exercise);

  // An untouched step draws no finding: the scaffold carries blockers from the start.
  const quiet = stepState(exercise, 2).s === 'empty';
  const found = quiet ? [] : issues(exercise).filter((issue) => issue.step === 2);
  const forItem = (id: string): Issue[] =>
    found.filter((issue) => 'itemId' in issue && issue.itemId === id);
  const forBucket = (id: string): Issue[] =>
    found.filter((issue) => 'bucketId' in issue && issue.bucketId === id);
  const general = found.filter((issue) => !('itemId' in issue) && !('bucketId' in issue));
  const bucketLevel = found.filter((issue) => 'bucketId' in issue);

  const nameOf = (label: string) => (label.trim() === '' ? t('step2.unnamedBucket') : label);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('step2.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('step2.lede')}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
          <ClipboardPaste className="size-4" aria-hidden />
          {t('step2.bulkOpen')}
        </Button>
      </div>

      <section
        aria-label={t('step2.balanceTitle')}
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <p className="text-sm font-semibold tabular-nums">
          {t('step2.ready', { count: ready.length, total: exercise.items.length })}
        </p>
        <ul className="flex flex-col gap-2">
          {shown.map((bucket, at) => {
            const entry = spread[at];
            const count = entry?.count ?? 0;
            const share = entry?.share ?? 0;
            const skewed = forBucket(bucket.id).some((issue) => issue.code === 'SB_SKEWED');
            const empty = forBucket(bucket.id).some((issue) => issue.code === 'SB_BUCKET_EMPTY');
            return (
              <li
                key={bucket.id}
                aria-label={t('step2.balanceAria', { label: nameOf(bucket.label), count })}
                className={`flex items-center gap-3 rounded-md px-2 py-1 ${
                  empty ? 'outline-2 outline-error' : ''
                }`}
              >
                <span
                  className="w-28 shrink-0 truncate text-sm"
                  style={{ fontFamily: READING }}
                  aria-hidden
                >
                  {nameOf(bucket.label)}
                </span>
                <span
                  aria-hidden
                  className="h-2 flex-1 overflow-hidden rounded-full bg-(--ssz-bg-muted)"
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.round(share * 100)}%`,
                      background: skewed
                        ? 'var(--ssz-color-warning-500)'
                        : 'var(--ssz-color-primary-500)',
                    }}
                  />
                </span>
                <span
                  aria-hidden
                  className="w-6 text-right text-xs tabular-nums text-muted-foreground"
                >
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
        {bucketLevel.map((issue, at) => (
          <Finding key={`${issue.code}-${at}`} issue={issue} text={describeIssue(issue)} />
        ))}
      </section>

      <ReorderWithAnnouncer
        items={exercise.items.map((item) => ({ id: item.id, title: item.text }))}
        onReorder={(next) =>
          onChange(
            reorderItems(
              exercise,
              next.map((entry) => entry.id),
            ),
          )
        }
      >
        {(entry, position) => {
          const item = exercise.items.find((i) => i.id === entry.id);
          if (item === undefined) return null;
          const expanded = open.has(item.id);
          const notes = forItem(item.id);
          const panel = `sb-item-${item.id}-details`;

          return (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="min-w-40 flex-1 border-transparent shadow-none focus-visible:border-input"
                  style={{ fontFamily: READING }}
                  aria-label={t('step2.itemAria', { index: position })}
                  value={item.text}
                  placeholder={t('step2.itemPlaceholder')}
                  onChange={(event) =>
                    onChange(setItem(exercise, item.id, { text: event.target.value }))
                  }
                />

                <div
                  role="group"
                  aria-label={t('step2.pickerAria', { index: position })}
                  className="flex flex-wrap gap-1"
                >
                  {shown.map((bucket) => (
                    <button
                      key={bucket.id}
                      type="button"
                      aria-pressed={item.bucketId === bucket.id}
                      onClick={() => onChange(assignBucket(exercise, item.id, bucket.id))}
                      className={`min-h-8 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                        item.bucketId === bucket.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:bg-[var(--ssz-bg-subtle)]'
                      }`}
                      style={{ fontFamily: READING }}
                    >
                      {nameOf(bucket.label)}
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-expanded={expanded}
                  aria-controls={panel}
                  aria-label={t('step2.expand', { index: position })}
                  onClick={() => toggle(item.id)}
                >
                  {expanded ? (
                    <ChevronDown className="size-4" aria-hidden />
                  ) : (
                    <ChevronRight className="size-4" aria-hidden />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('step2.remove', { index: position })}
                  onClick={() => onChange(removeItem(exercise, item.id))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>

              {notes.map((issue, at) => (
                <Finding
                  key={`${issue.code}-${at}`}
                  issue={issue}
                  text={describeIssue(issue, { bare: true })}
                />
              ))}

              {expanded && (
                <div id={panel} className="flex flex-col gap-3 border-t border-border pt-3">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium">{t('step2.alsoTitle')}</p>
                    <p className="text-xs text-muted-foreground">{t('step2.alsoHelp')}</p>
                    {item.bucketId === null ? (
                      <p className="text-xs text-muted-foreground">{t('step2.alsoNone')}</p>
                    ) : shown.length < 2 ? (
                      <p className="text-xs text-muted-foreground">{t('step2.alsoNoOthers')}</p>
                    ) : (
                      <div
                        role="group"
                        aria-label={t('step2.alsoTitle')}
                        className="flex flex-wrap gap-1"
                      >
                        {shown
                          .filter((bucket) => bucket.id !== item.bucketId)
                          .map((bucket) => (
                            <button
                              key={bucket.id}
                              type="button"
                              aria-pressed={item.also.includes(bucket.id)}
                              onClick={() => onChange(toggleAlso(exercise, item.id, bucket.id))}
                              className={`min-h-8 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                                item.also.includes(bucket.id)
                                  ? 'border-primary bg-[var(--ssz-bg-subtle)]'
                                  : 'border-dashed border-border hover:bg-[var(--ssz-bg-subtle)]'
                              }`}
                              style={{ fontFamily: READING }}
                            >
                              {nameOf(bucket.label)}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" htmlFor={`sb-why-${item.id}`}>
                      {t('step2.whyLabel')}
                    </label>
                    <Textarea
                      id={`sb-why-${item.id}`}
                      rows={2}
                      value={item.why}
                      placeholder={t('step2.whyPlaceholder')}
                      onChange={(event) =>
                        onChange(setItem(exercise, item.id, { why: event.target.value }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          );
        }}
      </ReorderWithAnnouncer>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => onChange(addItem(exercise))}>
          <Plus className="size-4" aria-hidden />
          {t('step2.addItem')}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t('step2.itemsCount', { count: exercise.items.length })} · {t('step2.readyHelp')}
        </span>
      </div>

      {/* Findings that belong to no row and no bucket — too few items, too many that accept
          several buckets — sit under the list rather than on whichever row is last. */}
      {general.map((issue, at) => (
        <Finding key={`${issue.code}-${at}`} issue={issue} text={describeIssue(issue)} boxed />
      ))}

      <BulkPasteDialog
        open={bulkOpen}
        exercise={exercise}
        onOpenChange={setBulkOpen}
        onApply={(text) => onChange(applyBulkPaste(exercise, text))}
      />
    </div>
  );
}

/** A blocker is red, a warning amber; the icon says so as well as the colour. */
function Finding({ issue, text, boxed = false }: { issue: Issue; text: string; boxed?: boolean }) {
  const tone = issue.level === 'blocker' ? 'text-error' : 'text-warning-700';
  const border = issue.level === 'blocker' ? 'border-error/40' : 'border-warning-500/40';
  return (
    <p
      className={`flex items-start gap-1.5 text-xs ${tone} ${
        boxed ? `rounded-lg border px-3 py-2 ${border}` : ''
      }`}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {text}
    </p>
  );
}

/**
 * A worksheet becomes a list in one paste — `item | bucket label`.
 *
 * The parse runs live, so the count under the box is the count that will be added and the
 * line about the ones with no bucket is said **before** the author commits (AC-I4). A label
 * that matches no bucket leaves its item unassigned; a bucket is never made from one.
 */
function BulkPasteDialog<T extends SortIntoBucketsContent>({
  open,
  exercise,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  exercise: T;
  onOpenChange: (open: boolean) => void;
  onApply: (text: string) => void;
}) {
  const t = useTranslations('Authoring.sortIntoBuckets');
  const [text, setText] = useState('');

  const parsed = parseBulk(exercise, text);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setText('');
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('step2.bulkTitle')}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">{t('step2.bulkHelp')}</p>
        <Textarea
          rows={8}
          className="font-mono text-[13px]"
          aria-label={t('step2.bulkTitle')}
          value={text}
          placeholder={t('step2.bulkPlaceholder')}
          onChange={(event) => setText(event.target.value)}
        />
        {parsed.items.length > 0 && (
          <div role="status" className="flex flex-col gap-0.5 text-xs">
            <p className="text-success-700">
              {t('step2.bulkParsed', { count: parsed.items.length })}
            </p>
            {parsed.unmatched > 0 && (
              <p className="text-warning-700">
                {t('step2.bulkUnmatched', { count: parsed.unmatched })}
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t('step2.bulkNote')}</p>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => close(false)}>
            {t('step2.bulkCancel')}
          </Button>
          <Button
            type="button"
            disabled={parsed.items.length === 0}
            onClick={() => {
              onApply(text);
              close(false);
            }}
          >
            {t('step2.bulkApply', { count: parsed.items.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
