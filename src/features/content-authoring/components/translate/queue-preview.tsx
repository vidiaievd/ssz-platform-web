'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Info, Pencil, Undo2, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SentenceRow } from '@/features/review/components/submission/sentence-row';
import type { TranslateItemDetail } from '@/features/content-authoring/types/review';
import {
  answerLang,
  judge,
  route,
  runItems,
  type Item,
  type Judgement,
  type Translate,
} from '@/lib/shared-kernel/translate';

import { DiffLegend } from './tr-marks';

export interface QueuePreviewProps {
  exercise: Translate;
}

/**
 * What a handed-in set looks like on the teacher's side, over answers the author writes
 * themselves.
 *
 * The prototype filled this section with three canned submissions. There are none here on
 * purpose: invented student answers would be the one thing on this screen that is not
 * true about this exercise, and the number they carry — how much of the set lands on a
 * teacher — is precisely the number an author comes to this section to find out. So the
 * answers are the author's own, judged by the same kernel the server runs.
 *
 * The card around them is not a drawing of the review screen but the review screen's own
 * `SentenceRow`, fed a breakdown built here instead of by the engine. One component and
 * one judgement means an author cannot be shown a card the teacher will not get: when the
 * marking screen changes, this preview changes with it. What is deliberately not here is
 * the author's explanation of the key — the teacher's screen does not carry it either,
 * and a preview that showed more than the real thing would be the wrong kind of helpful.
 */
export function QueuePreview({ exercise }: QueuePreviewProps) {
  const t = useTranslations('Authoring');
  const items = runItems(exercise);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Local and thrown away: the point is that the affordance is there, sentence by
  // sentence, exactly where the teacher will find it.
  const [comments, setComments] = useState<Record<string, string>>({});

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
  const judged = items.map((item) => {
    const answer = answers[item.id] ?? '';
    const judgement = judge(exercise.check, item, answer);
    return { item, detail: asDetail(exercise, item, answer, judgement) };
  });
  const passed = judged.filter((row) => row.detail.routing === 'pass').length;

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
              style={{ fontFamily: 'var(--ssz-font-reading)' }}
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

          {judged.some((row) => row.detail.routing !== 'pass') && (
            <div className="flex justify-end">
              <DiffLegend />
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {judged.map(({ item, detail }, index) => (
              <SentenceRow
                // Remounted when the routing flips, so a row that has just become a hit
                // collapses: `SentenceRow` decides open-or-closed once, which is right on
                // the marking screen — where the breakdown arrives finished — and wrong
                // here, where the author is editing the answer under it.
                key={`${item.id}:${detail.routing}`}
                detail={detail}
                index={index + 1}
                prompt={item.source}
                teacherNote={item.teacherNote ?? undefined}
                comment={comments[item.id]}
                onComment={(value) =>
                  setComments((current) => {
                    const next = { ...current };
                    if (value === undefined) delete next[item.id];
                    else next[item.id] = value;
                    return next;
                  })
                }
              />
            ))}
          </ul>

          {/* The verdict is one decision about the whole submission, taken at the foot of
              the marking screen — which is where these three sit there too. Inert here:
              this submission is the author's own, and there is nobody to send it back to. */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
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

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('translate.queue.actionsInInbox')}
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

/**
 * The author's own answer, in the shape the engine sends a teacher.
 *
 * Everything `SentenceRow` reads comes from the judgement; nothing is invented for the
 * preview. `itemId` is the authoring item's id because in a real submission it is too —
 * that is what a comment is filed against.
 */
function asDetail(
  exercise: Translate,
  item: Item,
  answer: string,
  judgement: Judgement,
): TranslateItemDetail {
  return {
    itemId: item.id,
    similarity: judgement.sim,
    routing: route(exercise.check, judgement),
    prompt: item.source,
    note: item.teacherNote ?? null,
    verdict: judgement.verdict,
    ref: judgement.ref,
    submitted: answer,
    tokens: judgement.tokens,
    missing: judgement.missing,
    banned: judgement.banned,
  };
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
