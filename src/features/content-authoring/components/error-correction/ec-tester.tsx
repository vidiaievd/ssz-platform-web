'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, CircleAlert, Target, User } from 'lucide-react';

import {
  authoredItems,
  EMPTY_EDITS,
  judge,
  route,
  toStudentProjection,
  type AlignOp,
  type ErrorCorrection,
  type Item,
  type Judgement,
  type StudentEdits,
  type Verdict,
} from '@/lib/shared-kernel/error-correction';
import { ErrorCorrectionBody } from '@/features/student/exercises/runner';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';

const READING = 'var(--ssz-font-reading)';

/** How each verdict reads: good, worth a look, or bad. Only `exact` is ever a pass. */
const VERDICT_TONE: Record<Verdict, 'ok' | 'warn' | 'bad' | 'muted'> = {
  exact: 'ok',
  typo: 'warn',
  partial: 'warn',
  stray: 'warn',
  off: 'bad',
  empty: 'muted',
  noref: 'muted',
};

export interface EcTesterProps {
  exercise: ErrorCorrection;
}

/**
 * The author correcting their own sentence with the student's editor, and seeing the
 * verdict a student would get.
 *
 * It runs the kernel's `judge` and `route` directly rather than going through the attempt
 * API, which is the one place in the product where that is right: the author already has
 * the answer key on screen, so nothing is leaked, and a tester that needed a saved
 * exercise and a round trip would not be usable while typing.
 *
 * It is here rather than in step 2 alone because the settings in step 3 change what it
 * reports — the same panel, in both places, is what makes those settings legible.
 */
export function EcTester({ exercise }: EcTesterProps) {
  const t = useTranslations('Authoring');
  const items = authoredItems(exercise);
  const [index, setIndex] = useState(0);

  const position = Math.min(index, items.length - 1);
  const item = items[position];
  if (item === undefined) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-[var(--ssz-bg-subtle)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4" aria-hidden />
          {t('errorCorrection.tester.title')}
        </h3>
        <span className="flex-1" />
        {items.length > 1 && (
          <select
            className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
            aria-label={t('errorCorrection.tester.pick')}
            value={String(position)}
            onChange={(event) => setIndex(Number(event.target.value))}
          >
            {items.map((each, at) => (
              <option key={each.id} value={at}>
                {exercise.mode === 'passage'
                  ? t('errorCorrection.step2.textLabel')
                  : t('errorCorrection.step2.sentenceLabel', { index: at + 1 })}
              </option>
            ))}
          </select>
        )}
      </div>

      {/*
        A trial belongs to the sentence it was made on. The key is the pair itself, so
        editing either line remounts the trial and drops it — a verdict left standing over
        words that have since changed is a verdict on a sentence nobody is looking at.
      */}
      <Trial key={`${item.id}|${item.wrong}|${item.ref}`} exercise={exercise} item={item} />
    </section>
  );
}

interface TrialProps {
  exercise: ErrorCorrection;
  item: Item;
}

/** One go at one sentence: the student's editor, and what the machine makes of it. */
function Trial({ exercise, item }: TrialProps) {
  const t = useTranslations('Authoring');
  const [edits, setEdits] = useState<StudentEdits>(EMPTY_EDITS);

  const projection = toStudentProjection({
    mode: exercise.mode,
    // The context line belongs to the exercise, not to this one sentence.
    note: '',
    items: [item],
    hints: exercise.hints,
    check: exercise.check,
    flow: exercise.flow,
  });

  const judgement = judge(exercise.check, item, edits);
  const routing = route(exercise.check, judgement);
  const touched =
    Object.values(edits.marked).some(Boolean) ||
    Object.values(edits.ins).some((word) => word.trim() !== '');

  return (
    <>
      <div className="rounded-md border border-border bg-surface p-3">
        <ErrorCorrectionBody
          projection={projection}
          value={{ [item.id]: edits }}
          onValueChange={(value) => setEdits(value[item.id] ?? EMPTY_EDITS)}
          onAnswerChange={() => {}}
          phase="answering"
          mode="practice"
          accent={PRACTICE_ACCENT}
        />
      </div>

      {touched ? (
        <Outcome exercise={exercise} judgement={judgement} routing={routing} />
      ) : (
        <p className="text-xs text-muted-foreground">{t('errorCorrection.tester.howTo')}</p>
      )}
    </>
  );
}

interface OutcomeProps {
  exercise: ErrorCorrection;
  judgement: Judgement;
  routing: 'pass' | 'teacher';
}

/**
 * What the machine made of the trial. The routing pill is the part authors come here
 * for: the auto-check can only ever approve, so everything that is not an exact hit says
 * so plainly rather than looking like a near miss that would still pass.
 */
function Outcome({ exercise, judgement, routing }: OutcomeProps) {
  const t = useTranslations('Authoring');
  const tone = VERDICT_TONE[judgement.verdict];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            tone === 'ok'
              ? 'bg-success-50 text-success-700'
              : tone === 'warn'
                ? 'bg-warning-100 text-warning-700'
                : tone === 'bad'
                  ? 'bg-error/10 text-error'
                  : 'bg-[var(--ssz-bg-subtle)] text-muted-foreground'
          }`}
        >
          {tone === 'ok' ? (
            <Check className="size-3" aria-hidden />
          ) : (
            <CircleAlert className="size-3" aria-hidden />
          )}
          {t(`errorCorrection.verdict.${judgement.verdict}` as 'errorCorrection.verdict.exact')}
        </span>
        <span
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
            routing === 'pass'
              ? 'border-success-500/50 text-success-700'
              : 'border-border text-[var(--ssz-text-secondary)]'
          }`}
        >
          {routing === 'pass' ? (
            <Check className="size-3" aria-hidden />
          ) : (
            <User className="size-3" aria-hidden />
          )}
          {routing === 'pass'
            ? t('errorCorrection.tester.routePass')
            : t('errorCorrection.tester.routeTeacher')}
        </span>
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {t('errorCorrection.tester.fixed', {
            fixed: judgement.fixedCount,
            total: judgement.spanCount,
          })}
        </span>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase">
          {t('errorCorrection.tester.built')}
        </p>
        <p className="text-sm" style={{ fontFamily: READING }}>
          {judgement.built}
        </p>
      </div>

      {judgement.verdict !== 'exact' && (
        <>
          <Diff ops={judgement.ops} />
          <ul className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <li>{t('errorCorrection.tester.legendExtra')}</li>
            <li>{t('errorCorrection.tester.legendMissing')}</li>
            <li>{t('errorCorrection.tester.legendTypo')}</li>
          </ul>
        </>
      )}

      {judgement.stray.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-warning-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('errorCorrection.tester.stray', {
            words: judgement.stray
              .map((edit) => `«${edit.word === '' ? '…' : edit.word}»`)
              .join(', '),
            policy: t(
              `errorCorrection.tester.strayPolicy.${exercise.check.strayEdits}` as 'errorCorrection.tester.strayPolicy.flag',
            ),
          })}
        </p>
      )}
    </div>
  );
}

/**
 * The submitted sentence against the answer key, word by word: what is superfluous, what
 * is missing, and what is the right word spelt wrong.
 */
function Diff({ ops }: { ops: AlignOp[] }) {
  const t = useTranslations('Authoring');

  return (
    <p
      className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-2 text-sm"
      style={{ fontFamily: READING }}
      aria-label={t('errorCorrection.tester.diffLabel')}
    >
      {ops.map((op, position) => (
        <span
          key={position}
          className={
            op.t === 'extra'
              ? 'rounded bg-error/10 px-1 text-error line-through'
              : op.t === 'missing'
                ? 'rounded bg-success-50 px-1 text-success-700'
                : op.typo !== null
                  ? 'rounded bg-warning-100 px-1 text-warning-700'
                  : undefined
          }
        >
          {op.typo ?? op.w}
        </span>
      ))}
    </p>
  );
}
