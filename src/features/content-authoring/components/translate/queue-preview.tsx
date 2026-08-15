'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ban, Bot, CircleAlert, Info, Pencil, Undo2, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  answerLang,
  judge,
  route,
  runItems,
  type Item,
  type Judgement,
  type Translate,
} from '@/lib/shared-kernel/translate';

import { DiffLine, VerdictChip } from './tr-marks';

const READING = 'var(--ssz-font-reading)';

export interface QueuePreviewProps {
  exercise: Translate;
}

/**
 * What a handed-in set looks like on the teacher's side, over answers the author writes
 * themselves.
 *
 * The prototype fills this section with three canned submissions. There are none here on
 * purpose: invented student answers would be the one thing on this screen that is not
 * true about this exercise, and the number they carry — how much of the set lands on a
 * teacher — is precisely the number an author comes to this section to find out. So the
 * answers are the author's own, judged by the same kernel the server runs, and the card
 * around them is the real shape of a submission: hits collapsed to a line, everything
 * else opened up with its diff, the author's notes and the guards that fired.
 *
 * The three actions are drawn and inert. The queue screen itself is plan 42's phase 8, and
 * a button that looked live would promise a screen that does not exist yet — but leaving
 * the actions out would hide the part of the design that explains why the queue is not
 * optional for this template.
 */
export function QueuePreview({ exercise }: QueuePreviewProps) {
  const t = useTranslations('Authoring');
  const items = runItems(exercise);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (items.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <Heading />
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          {t('translate.queue.noItems')}
        </p>
      </section>
    );
  }

  const written = items.filter((item) => (answers[item.id] ?? '').trim() !== '');
  const judged = items.map((item) => ({
    item,
    answer: answers[item.id] ?? '',
    judgement: judge(exercise.check, item, answers[item.id] ?? ''),
  }));
  const passed = judged.filter((row) => route(exercise.check, row.judgement) === 'pass').length;

  return (
    <section className="flex flex-col gap-3">
      <Heading />

      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={item.id} className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`tr-queue-${item.id}`}>
              {t('translate.step2.sentenceLabel', { index: index + 1 })} · {item.source}
            </label>
            <Input
              id={`tr-queue-${item.id}`}
              value={answers[item.id] ?? ''}
              style={{ fontFamily: READING }}
              placeholder={t('translate.queue.answerPlaceholder', {
                lang: answerLang(exercise, item).toLowerCase(),
              })}
              onChange={(event) =>
                setAnswers((current) => ({ ...current, [item.id]: event.target.value }))
              }
            />
          </li>
        ))}
      </ul>

      {written.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('translate.queue.howTo')}</p>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-sm font-medium">
            <User className="size-4 text-muted-foreground" aria-hidden />
            {t('translate.queue.submissionTitle')}
            <span className="flex-1" />
            <span className="text-xs font-normal text-muted-foreground">
              {exercise.check.on
                ? t('translate.queue.summary', {
                    auto: passed,
                    manual: judged.length - passed,
                  })
                : t('translate.queue.summaryNoCheck', { count: judged.length })}
            </span>
          </p>

          <ul className="flex flex-col gap-3">
            {judged.map(({ item, answer, judgement }, index) =>
              route(exercise.check, judgement) === 'pass' ? (
                <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                  <span style={{ fontFamily: READING }}>{answer}</span>
                  <span className="flex-1" />
                  <VerdictChip verdict={judgement.verdict} />
                </li>
              ) : (
                <li key={item.id} className="flex flex-col gap-2 border-t border-border pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                    <span className="text-xs text-muted-foreground">{item.source}</span>
                    <span className="flex-1" />
                    <VerdictChip verdict={judgement.verdict} />
                    {judgement.verdict !== 'empty' && judgement.verdict !== 'noref' && (
                      <span className="text-[11px] text-muted-foreground">
                        {t('translate.tester.sim', { percent: Math.round(judgement.sim * 100) })}
                      </span>
                    )}
                  </div>

                  {judgement.tokens.length > 0 && <DiffLine tokens={judgement.tokens} />}

                  <Notes item={item} judgement={judgement} />

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" disabled>
                      {t('translate.queue.approve')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled>
                      <Pencil className="size-3.5" aria-hidden />
                      {t('translate.queue.comment')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled>
                      <Undo2 className="size-3.5" aria-hidden />
                      {t('translate.queue.sendBack')}
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('translate.queue.actionsSoon')}
          </p>

          {/* The AI stage keeps its place in the card and nothing else — no model is
              connected, and the handoff requires every AI surface to say so. */}
          {exercise.ai.on && (
            <p className="flex items-start gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              <Bot className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {t('translate.queue.aiNote')}
                <span className="ml-1 rounded-full bg-[var(--ssz-bg-subtle)] px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                  {t('translate.step4.aiInert')}
                </span>
              </span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Heading() {
  const t = useTranslations('Authoring');

  return (
    <div>
      <h3 className="text-xs font-medium">{t('translate.queue.title')}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{t('translate.queue.lede')}</p>
    </div>
  );
}

/**
 * Everything written about this sentence that only the teacher sees: the note the author
 * left for them, the explanation of the key, and the guards the answer tripped.
 */
function Notes({ item, judgement }: { item: Item; judgement: Judgement }) {
  const t = useTranslations('Authoring');
  const teacherNote = (item.teacherNote ?? '').trim();
  const explanation = (item.explanation ?? '').trim();

  return (
    <>
      {teacherNote !== '' && (
        <p className="flex items-start gap-2 text-xs text-[var(--ssz-text-secondary)]">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {teacherNote}
        </p>
      )}
      {explanation !== '' && (
        <p className="text-xs text-muted-foreground">
          {t('translate.queue.explanation', { text: explanation })}
        </p>
      )}
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
    </>
  );
}
