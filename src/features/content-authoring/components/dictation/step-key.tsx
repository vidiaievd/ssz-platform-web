'use client';

import { useState } from 'react';
import { Check, List, Plus, Scissors, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Textarea } from '@/components/ui/textarea';
import { ExerciseAudioPlayer } from '@/features/student/exercises/audio';
import { toTenths, type AudioIssue } from '@/lib/shared-kernel/audio';
import {
  allWords,
  audioIssuesOf,
  canAddSegment,
  DC_MAX_SEG,
  isTimed,
  issues,
  packOf,
  previewJoin,
  sentencesOf,
  timedCount,
  wordCount,
  type DictationContent,
  type Mode,
  type Segment,
} from '@/lib/shared-kernel/dictation';

import { AudioSegmentField, useAudioIssueCopy } from '../audio';
import { Callout, Card, Field, StepHead } from '../highlight-in-text/parts';
import {
  addSegment,
  applySplit,
  removeSegment,
  setMode,
  setSegmentAudio,
  setSegmentText,
  setTimecodeEdge,
} from './edits';
import { useIssueCopy } from './issue-copy';
import { Notes, type Note } from './notes';
import { useAuthorPlayer } from './use-author-player';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;

export interface StepKeyProps<T extends DictationContent> {
  exercise: T;
  onChange: (next: T) => void;
  /**
   * Segments whose timecode is an estimate from *Paste and split* (AC-B2). Session state of
   * the builder, not of the document — the kernel does not store it (plan 68 §4.2, 9) — so
   * it is held above the step and survives a trip to another one.
   */
  estimated: ReadonlySet<string>;
  onEstimatedChange: (next: ReadonlySet<string>) => void;
}

/**
 * Step 2: the key — exactly what is said, one sentence per segment (plan 68 §7.5).
 *
 * Switching to «One continuous text» with more than one sentence does not apply at once:
 * the join is shown first and applied on request (AC-B10); the focus words travel with their
 * words. *Paste and split* is offered only while the key is empty (BEHAVIOR §3). The author
 * sets a timecode by listening: the player's position goes to the start or the end of a
 * segment (AC-B3), and *Play* plays only that range (AC-B4).
 */
export function StepKey<T extends DictationContent>({
  exercise,
  onChange,
  estimated,
  onEstimatedChange,
}: StepKeyProps<T>) {
  const t = useTranslations('Authoring.dictation.step2');
  const copy = useIssueCopy(exercise);
  const describeAudio = useAudioIssueCopy();
  const { eng } = useAuthorPlayer(exercise.audio);

  const [paste, setPaste] = useState('');
  const [joining, setJoining] = useState(false);

  const { segments, mode } = exercise;
  const empty = segments.length <= 1 && !segments.some((s) => s.text.trim() !== '');
  const sentences = sentencesOf(paste, packOf(exercise.language));
  const pos = toTenths(eng.state.pos);
  const found = issues(exercise).filter((issue) => issue.step === 2);
  const audioFound = audioIssuesOf(exercise).filter((issue) => issue.part === 'segments');

  /** An edit that changes a segment's timecode makes it the author's, not an estimate. */
  const settle = (id: string) => {
    if (!estimated.has(id)) return;
    const next = new Set(estimated);
    next.delete(id);
    onEstimatedChange(next);
  };

  const chooseMode = (next: Mode) => {
    if (next === mode) return;
    // One sentence has nothing to join; several do, and the author sees how before it is done.
    if (next === 'whole' && segments.length > 1) setJoining(true);
    else onChange(setMode(exercise, next));
  };

  const applyJoin = () => {
    onChange(setMode(exercise, 'whole'));
    onEstimatedChange(new Set());
    setJoining(false);
  };

  const split = () => {
    const result = applySplit(exercise, paste);
    if (result.estimated.length === 0 && result.ex === exercise) return;
    onChange(result.ex);
    onEstimatedChange(new Set(result.estimated));
    setPaste('');
  };

  const stepNotes: Note[] = found
    .filter((issue) => !('segmentId' in issue))
    .map((issue) => ({ key: issue.code, level: issue.level, text: copy.describe(issue) }));

  const rowNotes = (seg: Segment): Note[] => [
    ...found
      .filter((issue) => 'segmentId' in issue && issue.segmentId === seg.id)
      .map((issue) => ({
        key: `${issue.code}`,
        level: issue.level,
        text: copy.describe(issue, { bare: true }),
      })),
    ...audioFound
      .filter((issue): issue is Extract<AudioIssue, { itemId: string }> => 'itemId' in issue)
      .filter((issue) => issue.itemId === seg.id)
      .map((issue) => ({ key: issue.code, level: issue.level, text: describeAudio(issue) })),
  ];

  const join = previewJoin(exercise);
  const words = allWords(exercise);

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card>
        <Field label={t('shapeLabel')}>
          <Segmented<Mode>
            aria-label={t('shapeLabel')}
            value={mode}
            onValueChange={chooseMode}
            options={[
              { value: 'segments', label: t('shapeSegments') },
              { value: 'whole', label: t('shapeWhole') },
            ]}
          />
        </Field>
        <p className="m-0 text-xs text-(--ssz-text-muted)">
          {mode === 'segments' ? t('shapeSegmentsHelp') : t('shapeWholeHelp')}
        </p>

        {joining && (
          <Callout tone="warn">
            <b className="font-semibold">
              {t('join.title', { count: segments.filter((s) => s.text.trim() !== '').length })}
            </b>{' '}
            {t('join.body')}
            <p
              data-testid="dc-join-text"
              className="m-0 mt-2 rounded-(--ssz-radius-sm) border border-(--ssz-border-default) bg-(--ssz-bg-surface) px-3 py-2 text-base text-(--ssz-text-primary)"
              style={READING}
            >
              {join.text === '' ? t('join.empty') : join.text}
            </p>
            {join.focus > 0 && (
              <p className="m-0 mt-1.5 text-xs">{t('join.focus', { count: join.focus })}</p>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={applyJoin}>
                <Check className="size-3.5" aria-hidden />
                {t('join.apply')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setJoining(false)}>
                <X className="size-3.5" aria-hidden />
                {t('join.cancel')}
              </Button>
            </div>
          </Callout>
        )}
      </Card>

      {empty && mode === 'segments' && (
        <Card icon={Scissors} title={t('paste.title')} labelledBy="dc-paste-title">
          <Textarea
            aria-labelledby="dc-paste-title"
            rows={4}
            className="text-base"
            style={{ ...READING, fieldSizing: 'fixed' }}
            value={paste}
            placeholder={t('paste.placeholder')}
            onChange={(event) => setPaste(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={sentences.length === 0} onClick={split}>
              <Scissors className="size-3.5" aria-hidden />
              {t('paste.split', { count: sentences.length })}
            </Button>
            <span className="text-xs text-(--ssz-text-muted)">{t('paste.note')}</span>
          </div>
        </Card>
      )}

      <Notes notes={stepNotes} />

      <Card
        icon={List}
        title={mode === 'whole' ? t('list.textTitle') : t('list.segmentsTitle')}
        labelledBy="dc-segments-title"
        note={t('list.note', {
          segments: segments.length,
          words,
          timed: timedCount(exercise),
        })}
        flush
        foot={
          mode === 'segments' ? (
            <div className="sticky bottom-0 rounded-b-(--ssz-radius-md) border-t border-(--ssz-border-default) bg-(--ssz-bg-subtle) p-3">
              <ExerciseAudioPlayer eng={eng} tone="quiet" />
            </div>
          ) : undefined
        }
      >
        <ol className="m-0 flex list-none flex-col gap-4 p-4">
          {segments.map((seg, index) => {
            const n = wordCount(seg.text);
            const num = index + 1;
            return (
              <li key={seg.id} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1.5 grid size-[22px] shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-xs font-semibold text-(--ssz-text-secondary)"
                >
                  {num}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Textarea
                    aria-label={t('row.textLabel', { index: num })}
                    rows={2}
                    className="text-base"
                    style={{ ...READING, fieldSizing: 'fixed' }}
                    value={seg.text}
                    placeholder={t('row.placeholder')}
                    onChange={(event) =>
                      onChange(setSegmentText(exercise, seg.id, event.target.value))
                    }
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-(--ssz-text-muted)">
                      {t('row.words', { count: n })}
                    </span>
                    {mode === 'segments' && (
                      <>
                        <AudioSegmentField
                          compact
                          name={t('row.name', { index: num })}
                          segment={seg.audio}
                          onChange={(next) => {
                            settle(seg.id);
                            onChange(setSegmentAudio(exercise, seg.id, next));
                          }}
                        />
                        {estimated.has(seg.id) && (
                          <span
                            title={t('row.estimatedTitle')}
                            className="rounded-full bg-(--ssz-color-warning-50) px-2 py-0.5 text-[11px] font-semibold text-(--ssz-color-warning-700)"
                          >
                            {t('row.estimated')}
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!isTimed(seg)}
                          aria-label={t('row.playLabel', { index: num })}
                          onClick={() => seg.audio && eng.playRange(seg.audio.start, seg.audio.end)}
                        >
                          {t('row.play')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pos === 0}
                          title={t('row.setStartTitle')}
                          aria-label={t('row.setStartLabel', { index: num })}
                          onClick={() => {
                            settle(seg.id);
                            onChange(setTimecodeEdge(exercise, seg.id, 'start', eng.state.pos));
                          }}
                        >
                          {t('row.setStart')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pos === 0}
                          aria-label={t('row.setEndLabel', { index: num })}
                          onClick={() => {
                            settle(seg.id);
                            onChange(setTimecodeEdge(exercise, seg.id, 'end', eng.state.pos));
                          }}
                        >
                          {t('row.setEnd')}
                        </Button>
                      </>
                    )}
                    <span className="flex-1" />
                    {segments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('row.remove', { index: num })}
                        onClick={() => {
                          settle(seg.id);
                          onChange(removeSegment(exercise, seg.id));
                        }}
                      >
                        <Trash2 className="size-3.5 text-(--ssz-color-error-700)" aria-hidden />
                      </Button>
                    )}
                  </div>
                  <Notes notes={rowNotes(seg)} />
                </div>
              </li>
            );
          })}
        </ol>
        {mode === 'segments' && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canAddSegment(exercise)}
              onClick={() => onChange(addSegment(exercise).ex)}
            >
              <Plus className="size-3.5" aria-hidden />
              {t('row.add')}
            </Button>
            {segments.length >= DC_MAX_SEG && (
              <span className="text-xs text-(--ssz-text-muted)">
                {t('row.ceiling', { max: DC_MAX_SEG })}
              </span>
            )}
          </div>
        )}
      </Card>

      <Callout tone="warn">
        <b className="font-semibold">{t('warnTitle')}</b> {t('warnBody')}
      </Callout>
    </div>
  );
}
