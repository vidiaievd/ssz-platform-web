'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import type { AudioDraft } from '@/lib/shared-kernel/audio';
import {
  buckets,
  cells,
  coverage,
  issues,
  readyItems,
  stepState,
  type SortIntoBucketsContent,
} from '@/lib/shared-kernel/sort-into-buckets';

import { AudioTranscriptCard } from '../audio';
import { FeedbackMatrix, type MatrixCopy } from '../feedback-matrix';
import { setBucket, setDefault, setOverride } from './edits';

const READING = 'var(--ssz-font-reading)';

type View = 'items' | 'matrix';

export interface StepFeedbackProps<T extends SortIntoBucketsContent> {
  exercise: T;
  onChange: (next: T) => void;
  audio?: AudioDraft;
  onAudioChange?: (next: AudioDraft) => void;
}

/**
 * Step 3: why a wrong bucket is wrong.
 *
 * The one text every ready item owes is the default (`SB_NO_EXPLANATION`, a blocker, AC-F1);
 * a text per (item × wrong bucket) is coverage the author grows over time and an empty cell
 * is legitimate. Both views write the same `fb` field (AC-F2), so which one is open is only
 * a matter of how the author wants to walk the table. A bucket an item *accepts* is never a
 * cell, in either view (AC-F3) — there is nothing wrong to explain there.
 */
export function StepFeedback<T extends SortIntoBucketsContent>({
  exercise,
  onChange,
  audio,
  onAudioChange,
}: StepFeedbackProps<T>) {
  const t = useTranslations('Authoring.sortIntoBuckets');
  const [view, setView] = useState<View>('items');
  const [onlyEmpty, setOnlyEmpty] = useState(false);

  const ready = readyItems(exercise);
  const shown = buckets(exercise);
  const cov = coverage(exercise);
  const percent = cov.total === 0 ? 0 : Math.round((100 * cov.written) / cov.total);
  // An untouched step draws no finding, as in steps 1 and 2.
  const quiet = stepState(exercise, 3).s === 'empty';
  const nameOf = (label: string) => (label.trim() === '' ? t('step2.unnamedBucket') : label);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('step3.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('step3.lede')}</p>
      </div>

      {audio?.audio.enabled === true && onAudioChange !== undefined && (
        <AudioTranscriptCard draft={audio} onChange={onAudioChange} />
      )}

      <section
        aria-label={t('step3.coverageTitle')}
        className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
      >
        <p className="text-2xl font-semibold tabular-nums">
          {cov.written}
          <span className="text-base text-muted-foreground"> / {cov.total}</span>
        </p>
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-(--ssz-bg-muted)">
            <div
              className="h-full rounded-full bg-(--ssz-color-primary-600)"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{t('step3.coverage')}</p>
          <p
            className={`mt-0.5 flex items-center gap-1.5 text-xs ${
              cov.noDefault > 0 && !quiet ? 'text-error' : 'text-muted-foreground'
            }`}
          >
            {cov.noDefault > 0 && !quiet && (
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            )}
            {cov.noDefault > 0
              ? t('step3.noDefault', { count: cov.noDefault })
              : t('step3.allDefault')}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div>
          <h3 className="text-sm font-semibold">{t('step3.rulesTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('step3.rulesHelp')}</p>
        </div>
        <ul className="flex flex-col gap-2">
          {shown.map((bucket) => {
            const own = exercise.buckets.some((b) => b.id === bucket.id);
            return (
              <li key={bucket.id} className="flex items-center gap-2">
                <span
                  className="w-28 shrink-0 truncate text-sm"
                  style={{ fontFamily: READING }}
                  aria-hidden
                >
                  {nameOf(bucket.label)}
                </span>
                {own ? (
                  <Input
                    aria-label={t('step3.ruleAria', { label: nameOf(bucket.label) })}
                    value={bucket.rule}
                    placeholder={t('step3.rulePlaceholder')}
                    onChange={(event) =>
                      onChange(setBucket(exercise, bucket.id, { rule: event.target.value }))
                    }
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">{t('step3.noneNoRule')}</span>
                )}
              </li>
            );
          })}
        </ul>
        {!quiet && issues(exercise).some((issue) => issue.code === 'SB_BUCKET_NO_RULE') && (
          <p className="flex items-start gap-1.5 text-xs text-warning-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('step3.rulesWarning')}
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<View>
          value={view}
          aria-label={t('step3.viewLabel')}
          onValueChange={setView}
          options={[
            { value: 'items', label: t('step3.viewItems') },
            { value: 'matrix', label: t('step3.viewMatrix') },
          ]}
        />
        {view === 'items' && (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={onlyEmpty}
              onChange={(event) => setOnlyEmpty(event.target.checked)}
            />
            {t('step3.onlyEmpty')}
          </label>
        )}
      </div>

      {ready.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t('step3.empty')}
        </p>
      ) : view === 'items' ? (
        <ul className="flex flex-col gap-3">
          {ready.map((item, at) => {
            const wrong = shown.filter(
              (b) => !(item.bucketId === b.id || item.also.includes(b.id)),
            );
            const missing = (exercise.fb[item.id]?.def ?? '').trim() === '' && !quiet;
            const rows = onlyEmpty
              ? wrong.filter((b) => (exercise.fb[item.id]?.ov[b.id] ?? '').trim() === '')
              : wrong;
            const home = shown.find((b) => b.id === item.bucketId);
            return (
              <li
                key={item.id}
                className={`flex flex-col gap-3 rounded-lg border bg-surface p-4 ${
                  missing ? 'border-error' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="grid size-5 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
                  >
                    {at + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm" style={{ fontFamily: READING }}>
                    {item.text}
                  </span>
                  <span className="shrink-0 rounded-full border border-success-500 bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                    {nameOf(home?.label ?? '')}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" htmlFor={`sb-def-${item.id}`}>
                    {t('step3.defLabel')}
                  </label>
                  <Textarea
                    id={`sb-def-${item.id}`}
                    rows={2}
                    value={exercise.fb[item.id]?.def ?? ''}
                    hasError={missing}
                    aria-invalid={missing}
                    placeholder={t('step3.defPlaceholder')}
                    onChange={(event) =>
                      onChange(setDefault(exercise, item.id, event.target.value))
                    }
                  />
                  <p className={`text-xs ${missing ? 'text-error' : 'text-muted-foreground'}`}>
                    {missing ? t('issues.SB_NO_EXPLANATION') : t('step3.defHelp')}
                  </p>
                </div>

                {rows.map((b) => (
                  <div key={b.id} className="flex flex-col gap-1">
                    <label className="text-xs font-medium" htmlFor={`sb-ov-${item.id}-${b.id}`}>
                      {t('step3.ovLabel', { label: nameOf(b.label) })}
                    </label>
                    <Textarea
                      id={`sb-ov-${item.id}-${b.id}`}
                      rows={2}
                      value={exercise.fb[item.id]?.ov[b.id] ?? ''}
                      placeholder={t('step3.ovPlaceholder')}
                      onChange={(event) =>
                        onChange(setOverride(exercise, item.id, b.id, event.target.value))
                      }
                    />
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      ) : (
        <SortMatrix exercise={exercise} onChange={onChange} />
      )}
    </div>
  );
}

/**
 * Items × buckets, on the table `components/feedback-matrix.tsx` shares with the other
 * types. A row's accepted buckets — the primary and every `also` — are locked (AC-F3).
 */
function SortMatrix<T extends SortIntoBucketsContent>({
  exercise,
  onChange,
}: {
  exercise: T;
  onChange: (next: T) => void;
}) {
  const t = useTranslations('Authoring.sortIntoBuckets');
  const ready = readyItems(exercise);
  const shown = buckets(exercise);

  if (cells(exercise).length === 0) {
    return <p className="text-sm text-muted-foreground">{t('step3.matrix.empty')}</p>;
  }

  const rows = ready.map((item, at) => ({
    id: item.id,
    label: `${at + 1}. ${item.text}`,
    answerColumnId: item.bucketId ?? '',
    acceptedColumnIds: item.also,
    header: (
      <>
        <span className="block text-xs font-semibold">{at + 1}</span>
        <span
          className="block max-w-40 truncate text-xs text-muted-foreground"
          style={{ fontFamily: READING }}
          title={item.text}
        >
          {item.text}
        </span>
      </>
    ),
  }));
  const columns = shown.map((b) => ({
    id: b.id,
    label: b.label.trim() === '' ? t('step2.unnamedBucket') : b.label,
  }));

  const copy: MatrixCopy = {
    caption: t('step3.matrix.caption'),
    rowColumn: t('step3.matrix.rowColumn'),
    legend: t('step3.matrix.legend'),
    answerShort: t('step3.matrix.answerShort'),
    answerCell: (item, bucket) => t('step3.matrix.answerCell', { item, bucket }),
    writeCell: (item, bucket) => t('step3.matrix.writeCell', { item, bucket }),
    editCell: (item, bucket) => t('step3.matrix.editCell', { item, bucket }),
    editorTitle: (item, bucket) => t('step3.matrix.editorTitle', { item, bucket }),
    position: (at, of) => t('step3.matrix.position', { at, of }),
    previousCell: t('step3.matrix.previousCell'),
    nextCell: t('step3.matrix.nextCell'),
    closeEditor: t('step3.matrix.closeEditor'),
    shortcutHint: t('step3.matrix.shortcutHint'),
  };

  return (
    <FeedbackMatrix
      rows={rows}
      columns={columns}
      copy={copy}
      columnFont={READING}
      textFor={(itemId, bucketId) => exercise.fb[itemId]?.ov[bucketId] ?? ''}
      onCellChange={(itemId, bucketId, text) =>
        onChange(setOverride(exercise, itemId, bucketId, text))
      }
      placeholderFor={(itemId) => exercise.fb[itemId]?.def ?? ''}
    />
  );
}
