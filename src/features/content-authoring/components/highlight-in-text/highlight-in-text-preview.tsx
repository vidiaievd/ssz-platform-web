'use client';

import { useMemo, useState } from 'react';
import { Eye, Monitor, RotateCcw, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import {
  HighlightInTextBody,
  type HighlightInTextLayout,
} from '@/features/student/exercises/runner/highlight-in-text-body';
import {
  extendMark,
  keepExact,
  toggleMark,
  toWire,
} from '@/features/student/exercises/runner/highlight-in-text-marks';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';
import type {
  HighlightInTextQuestionState,
  HighlightInTextSubmitDetails,
} from '@/features/student/exercises/types/attempts';
import {
  check,
  paragraphOfTokens,
  tokenize,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  type HighlightInTextContent,
  type TokenRun,
} from '@/lib/shared-kernel/highlight-in-text';

/** The desktop body's own width in the prototype's preview (`wb-body[data-wide]`). */
const DESKTOP_MIN = 620;

export interface HighlightInTextPreviewProps {
  exercise: HighlightInTextContent;
}

/**
 * The student's view of the exercise being built — the runner's own body, not a lookalike
 * (AC-X10), fed through `toStudentProjection`, which is what drops the key and the unfinished
 * questions. So the panel answers the question an author really has: what is my student
 * handed?
 *
 * **The verdict is real.** It runs the kernel's `check`, the function the engine calls, and
 * the result is shaped like the engine's answer. The teacher owns the key, so judging in their
 * browser shows nothing to anybody (precedent: plans 54 and 66). It is not an attempt: nothing
 * is recorded.
 *
 * Three switches, as in the handoff (Q4-A): phone or desktop layout, Static (everything drawn,
 * nothing accepts input) or Live, and a restart. The desktop layout is wider than the preview
 * column and scrolls sideways rather than squeezing into a layout it was not drawn for.
 */
export function HighlightInTextPreview({ exercise }: HighlightInTextPreviewProps) {
  const t = useTranslations('Authoring.highlightInText.preview');

  const [device, setDevice] = useState<HighlightInTextLayout>('phone');
  const [mode, setMode] = useState<'static' | 'live'>('live');

  const projection = useMemo(
    () => toStudentProjection(toContent(exercise), toExpectedAnswers(exercise)),
    [exercise],
  );
  const tokens = useMemo(() => tokenize(projection.text), [projection.text]);
  const paragraphOf = useMemo(
    () => paragraphOfTokens(projection.text, tokens),
    [projection.text, tokens],
  );

  const [questionIndex, setQuestionIndex] = useState(0);
  const [marks, setMarks] = useState<TokenRun[]>([]);
  const [verdict, setVerdict] = useState<HighlightInTextSubmitDetails | null>(null);
  const [states, setStates] = useState<HighlightInTextQuestionState[]>([]);
  const [attempt, setAttempt] = useState(1);

  /*
    When what the student would be handed changes, the attempt starts again — during render,
    not in an effect, so no frame shows a verdict over a passage that just changed. The key
    and the hints are not in the signature on purpose: rewording a reason should not wipe a
    check the author is looking at; the next check reads the new key anyway.
  */
  const signature = JSON.stringify([
    projection.text,
    projection.questions,
    projection.settings,
    exercise.settings.threshold,
    exercise.settings.penalty,
  ]);
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    restart();
  }

  function restart() {
    setQuestionIndex(0);
    setMarks([]);
    setVerdict(null);
    setStates([]);
    setAttempt(1);
  }

  const question = projection.questions[questionIndex];
  const completed = projection.questions.map(
    (q) => states.find((s) => s.questionId === q.id)?.closed === true,
  );

  function send(reveal = false) {
    if (question === undefined) return;
    const outcome = check({
      ex: exercise,
      questionId: question.id,
      marks: reveal ? [] : toWire(marks, tokens),
      ...(reveal ? { reveal: true } : {}),
      questions: states,
    });
    // A refusal here is the runner offering what the engine would refuse — not reachable
    // through the body, which draws its buttons from the same state.
    if (!outcome.ok) return;
    const { completedNow: _completedNow, ...details } = outcome.result;
    setVerdict(details);
    setStates(details.questions);
    setAttempt(details.attempt);
  }

  function next() {
    const ahead = projection.questions.findIndex(
      (q, i) => i > questionIndex && states.find((s) => s.questionId === q.id)?.closed !== true,
    );
    if (ahead === -1) return;
    const here = states.find((s) => s.questionId === projection.questions[ahead]?.id);
    setQuestionIndex(ahead);
    setMarks([]);
    setVerdict(null);
    setAttempt((here?.checks ?? 0) + 1);
  }

  const body = (
    <HighlightInTextBody
      projection={projection}
      title={exercise.title}
      questionIndex={questionIndex}
      completed={completed}
      marks={marks}
      onMark={(origin, end) => {
        if (question === undefined) return;
        setMarks((current) => toggleMark(current, origin, end, question.unit, paragraphOf));
      }}
      onExtend={(i, delta) => {
        if (question?.unit !== 'phrase') return;
        setMarks((current) => extendMark(current, i, delta, paragraphOf));
      }}
      onClear={() => setMarks([])}
      verdict={verdict}
      attempt={attempt}
      interactive={mode === 'live'}
      layout={device}
      onCheck={() => send()}
      onRetry={() => {
        if (verdict === null) return;
        setMarks((current) => keepExact(current, verdict.cells, tokens));
        setAttempt(verdict.attempt + 1);
        setVerdict(null);
      }}
      onReveal={() => send(true)}
      onNext={next}
      accent={PRACTICE_ACCENT}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-(--ssz-border-default) px-3 py-2">
        <Eye size={15} aria-hidden="true" className="text-(--ssz-text-muted)" />
        <strong className="text-xs font-bold tracking-wide text-(--ssz-text-muted) uppercase">
          {device === 'phone' ? t('phone') : t('desktop')}
        </strong>
        <span className="flex-1" />
        <Segmented<HighlightInTextLayout>
          aria-label={t('deviceLabel')}
          size="sm"
          iconOnly
          value={device}
          onValueChange={setDevice}
          options={[
            { value: 'phone', label: t('phone'), icon: Smartphone },
            { value: 'desktop', label: t('desktop'), icon: Monitor },
          ]}
        />
        <Segmented<'static' | 'live'>
          aria-label={t('modeLabel')}
          size="sm"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'static', label: t('static') },
            { value: 'live', label: t('live') },
          ]}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('restart')}
          title={t('restart')}
          onClick={restart}
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>

      {/* No vertical padding on the scroller itself: the phone body pins its Check bar with
          `sticky bottom-0`, which stops at the scroller's content edge — a padded scroller
          left a strip of passage showing under the bar. The spacing lives one level in. */}
      <div className="flex-1 overflow-auto px-4">
        <div className="py-4">
          {device === 'desktop' ? (
            <div style={{ minWidth: DESKTOP_MIN }}>{body}</div>
          ) : (
            <div className="mx-auto max-w-[390px]">{body}</div>
          )}
        </div>
      </div>
      <p className="m-0 px-4 pb-3 text-[11px] text-(--ssz-text-muted)">{t('note')}</p>
    </div>
  );
}
