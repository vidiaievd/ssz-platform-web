'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ban, CircleAlert, Target } from 'lucide-react';

import { Textarea } from '@/components/ui/input';
import {
  judge,
  runItems,
  sourceLang,
  answerLang,
  type Judgement,
  type Translate,
} from '@/lib/shared-kernel/translate';
import { route } from '@/lib/shared-kernel/translate';

import { DiffLegend, DiffLine, RouteChip, VerdictChip } from './tr-marks';

const READING = 'var(--ssz-font-reading)';

export interface TrTesterProps {
  exercise: Translate;
}

/**
 * The author answering their own sentence as a student would, and seeing where that answer
 * lands.
 *
 * It runs the kernel's `judge` and `route` in the browser rather than through the attempt
 * API, which is the one place in the product where that is right: the author has the
 * answer key on screen already, so nothing leaks, and a tester that needed a saved
 * exercise and a round trip would be unusable while typing.
 *
 * What authors come here for is the routing pill. The auto-check of this template can only
 * ever approve, so a translation that reads perfectly well and misses the key by a word
 * still goes to the queue — and the only way to feel how much of the queue an exercise
 * will generate is to try a few honest answers against it. The tester appears again in
 * step 3, where the settings that move this line are edited.
 */
export function TrTester({ exercise }: TrTesterProps) {
  const t = useTranslations('Authoring');
  // `runItems` rather than every authored sentence: the tester answers "what would a
  // student get", and under the single-sentence format a student gets the first one.
  const items = runItems(exercise);
  const [index, setIndex] = useState(0);

  const position = Math.min(index, items.length - 1);
  const item = items[position];
  if (item === undefined) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-[var(--ssz-bg-subtle)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4" aria-hidden />
          {t('translate.tester.title')}
        </h3>
        <span className="flex-1" />
        {items.length > 1 && (
          <select
            className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
            aria-label={t('translate.tester.pick')}
            value={String(position)}
            onChange={(event) => setIndex(Number(event.target.value))}
          >
            {items.map((each, at) => (
              <option key={each.id} value={at}>
                {t('translate.step2.sentenceLabel', { index: at + 1 })}
              </option>
            ))}
          </select>
        )}
      </div>

      {/*
        A trial belongs to the sentence and the key it was made against. Both are in the
        remount key, so editing either drops the verdict rather than leaving one standing
        over words that have since changed.
      */}
      <Trial
        key={`${item.id}|${item.source}|${item.refs.join('|')}`}
        exercise={exercise}
        at={position}
      />
    </section>
  );
}

interface TrialProps {
  exercise: Translate;
  at: number;
}

/** One go at one sentence: the student's field, and what the machine makes of the answer. */
function Trial({ exercise, at }: TrialProps) {
  const t = useTranslations('Authoring');
  const [answer, setAnswer] = useState('');
  const item = runItems(exercise)[at]!;

  const judgement = judge(exercise.check, item, answer);
  const routing = route(exercise.check, judgement);

  return (
    <>
      <div className="rounded-md border border-border bg-surface p-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase">
          {sourceLang(exercise, item)}
        </p>
        <p className="mb-2 text-sm" style={{ fontFamily: READING }}>
          {item.source || t('translate.tester.noSource')}
        </p>
        <Textarea
          rows={2}
          value={answer}
          aria-label={t('translate.tester.answerLabel', { lang: answerLang(exercise, item) })}
          placeholder={t('translate.tester.answerPlaceholder', {
            lang: answerLang(exercise, item).toLowerCase(),
          })}
          onChange={(event) => setAnswer(event.target.value)}
        />
      </div>

      {answer.trim() === '' ? (
        <p className="text-xs text-muted-foreground">{t('translate.tester.howTo')}</p>
      ) : (
        <Outcome judgement={judgement} routing={routing} />
      )}
    </>
  );
}

interface OutcomeProps {
  judgement: Judgement;
  routing: 'pass' | 'teacher';
}

/**
 * What the machine made of the trial.
 *
 * The diff shows the key's own words in full here, unlike the student's self-check: the
 * author wrote them, and hiding them from the person who has the key open in the field
 * above would be theatre.
 */
function Outcome({ judgement, routing }: OutcomeProps) {
  const t = useTranslations('Authoring');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictChip verdict={judgement.verdict} />
        <RouteChip routing={routing} />
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {t('translate.tester.sim', { percent: Math.round(judgement.sim * 100) })}
        </span>
      </div>

      {judgement.verdict !== 'noref' && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase">
            {t('translate.tester.closest')}
          </p>
          <p className="text-sm" style={{ fontFamily: READING }}>
            {judgement.ref}
          </p>
        </div>
      )}

      {judgement.verdict !== 'exact' && judgement.verdict !== 'noref' && (
        <>
          <DiffLine tokens={judgement.tokens} />
          <DiffLegend />
        </>
      )}

      {/* The guards, which are the only thing the machine may call wrong outright — and
          the author's own note is what the student would be shown when one fires. */}
      {judgement.missing.map((guard, index) => (
        <p key={`m${index}`} className="flex items-start gap-2 text-xs text-warning-700">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {t('translate.tester.requireMissed', { text: guard.text })}
            {guard.note !== undefined && guard.note !== '' && ` — ${guard.note}`}
          </span>
        </p>
      ))}
      {judgement.banned.map((guard, index) => (
        <p key={`b${index}`} className="flex items-start gap-2 text-xs text-error">
          <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {t('translate.tester.forbidHit', { text: guard.text })}
            {guard.note !== undefined && guard.note !== '' && ` — ${guard.note}`}
          </span>
        </p>
      ))}
    </div>
  );
}
