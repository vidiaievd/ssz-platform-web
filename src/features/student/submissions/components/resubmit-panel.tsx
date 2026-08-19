'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { CharPad } from '@/components/shared/char-pad';
import { Button } from '@/components/ui/button';
import {
  clearAnswerDraft,
  readAnswerDraft,
  saveAnswerDraft,
} from '@/features/student/exercises/lib/answer-draft';

import { ResubmitError, useResubmit, type ResubmitFailure } from '../api/use-resubmit';
import type { MySubmission } from '../types';

const NORWEGIAN_CHARS = ['æ', 'ø', 'å'] as const;

/** What the field holds, restored across a reload the same way the runner's drafts are. */
function draftText(exerciseId: string): string {
  const draft = readAnswerDraft(exerciseId);
  if (typeof draft !== 'object' || draft === null) return '';
  const { text } = draft as { text?: unknown };
  return typeof text === 'string' ? text : '';
}

export interface ResubmitPanelProps {
  submission: MySubmission;
}

/**
 * A second go at an essay, written where the comment is (plan 47.3).
 *
 * The teacher's remark is a few centimetres above this field, and that is the point: on
 * the templates whose whole submission is one block of prose, moving the learner to
 * another screen to rewrite it would put the remark behind a back button at exactly the
 * moment it is meant to be read. Everything with more structure than this goes to the
 * runner instead (`lib/resubmit-route.ts`).
 *
 * What is written survives a reload before it is sent, and is never sent on the learner's
 * behalf: the draft rules of 47.0.C hold here too — a person's own words go when they
 * press the button, not when the network recovers.
 */
export function ResubmitPanel({ submission }: ResubmitPanelProps) {
  const t = useTranslations('Review.student.resubmit');
  const locale = useLocale();
  const fieldId = useId();

  const [text, setText] = useState(() => draftText(submission.exerciseId));
  const [sent, setSent] = useState(false);
  // Set in an effect rather than at first render: reading the clock during render is a
  // side effect, and the number is only ever wanted once the panel is on screen anyway.
  const startedAt = useRef<number>(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const resubmit = useResubmit();
  const failure: ResubmitFailure | null =
    resubmit.error instanceof ResubmitError ? resubmit.error.resolution : null;
  // An error of another shape is still a failed send with the answer still in hand.
  const problem: ResubmitFailure | null = failure ?? (resubmit.isError ? 'not-sent' : null);

  function change(value: string) {
    setText(value);
    saveAnswerDraft(submission.exerciseId, value.trim() === '' ? null : { text: value });
  }

  function send() {
    resubmit.mutate(
      {
        exerciseId: submission.exerciseId,
        targetLanguage: submission.targetLanguage,
        text,
        timeSpentSeconds: startedAt.current === 0 ? 0 : (Date.now() - startedAt.current) / 1000,
        locale,
      },
      {
        onSuccess: () => {
          clearAnswerDraft(submission.exerciseId);
          setSent(true);
        },
        onError: (error) => {
          // It was with the teacher all along. Clearing the draft is the honest move —
          // keeping it would invite the learner to send the same essay a second time,
          // which the engine would refuse and they would read as a fault of their own.
          if (error instanceof ResubmitError && error.resolution === 'delivered') {
            clearAnswerDraft(submission.exerciseId);
            setSent(true);
          }
        },
      },
    );
  }

  if (sent) {
    return (
      <p className="text-[13px] font-semibold text-(--ssz-text-secondary)">
        {problem === 'delivered' ? t('alreadyThere') : t('sent')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-[12.5px] font-semibold">
        {t('label')}
      </label>
      <textarea
        id={fieldId}
        value={text}
        onChange={(event) => change(event.target.value)}
        rows={6}
        className="w-full resize-y rounded-[11px] border-[1.5px] border-(--ssz-border-default) bg-(--ssz-bg-surface) px-3.5 py-3 text-[14.5px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ fontFamily: 'var(--ssz-font-reading)' }}
        placeholder={t('placeholder')}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* The letters a keyboard bought abroad does not have — the same pad the runner
            offers, for the same reason: without them half the words cannot be written. */}
        <CharPad chars={NORWEGIAN_CHARS} label={t('charPad')} />
        <Button size="sm" onClick={send} disabled={text.trim() === '' || resubmit.isPending}>
          {resubmit.isPending ? t('sending') : t('submit')}
        </Button>
      </div>

      {problem !== null && (
        <p role="status" className="text-[12.5px] text-(--ssz-feedback-no-fg)">
          {t(`failed.${problem}`)}
        </p>
      )}
    </div>
  );
}
