'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Info, Plus, Trash2, TriangleAlert, Wand2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/input';
import {
  audit,
  coverage,
  grade,
  modelPasses,
  usableElements,
  type Issue,
  type KeyElement,
  type Question,
  type QuestionResult,
  type Verdict,
} from '@/lib/shared-kernel/short-answer';

import { ChipEditor } from '../chip-editor';
import {
  addAnchor,
  addElement,
  MAX_ELEMENTS,
  removeAnchor,
  removeElement,
  setElement,
  type ShortAnswerDocument,
} from './edits';
import { useIssueCopy } from './issue-copy';

export interface StepKeyProps {
  exercise: ShortAnswerDocument;
  onChange: (next: ShortAnswerDocument) => void;
}

/**
 * Step 2: the answer key — the heart of this builder.
 *
 * A short answer cannot be matched word for word, so the key is semantic elements: each
 * one thing the answer has to say, carrying the two or three phrasings a student might say
 * it with. What makes the step work is that everything on it is *derived on the keystroke*
 * from the same grader that will mark the student — the row turning green, the verdict chip
 * on the model answer, the coverage strip, the audit, and the tester at the bottom are five
 * views of one function.
 *
 * The one that matters is the model answer's own verdict. `modelPasses` runs the author's
 * answer through the author's key, and a failure is a blocker rather than a warning: if the
 * answer they would accept does not pass, no student's will. It is the most useful
 * validation in the builder and the reason the model answer is written a step earlier.
 */
export function StepKey({ exercise, onChange }: StepKeyProps) {
  const t = useTranslations('Authoring');
  const cov = coverage(exercise);
  const percent = cov.total === 0 ? 0 : Math.round((cov.done / cov.total) * 100);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('shortAnswer.step2.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('shortAnswer.step2.lede')}</p>
      </div>

      {/* The strip counts model answers that pass, not elements written: a key nobody has
          tested is not progress, and this is the number the gate repeats. */}
      <section className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
        <p className="text-2xl font-bold tabular-nums">
          {cov.done}
          <span className="text-base font-normal text-muted-foreground">/{cov.total}</span>
        </p>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{t('shortAnswer.step2.coverage')}</p>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-(--ssz-bg-muted)"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('shortAnswer.step2.coverage')}
          >
            <i
              className="block h-full rounded-full bg-success-500 transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('shortAnswer.step2.anchorCount', { count: cov.anchors })}
          </p>
        </div>
      </section>

      <ul className="flex flex-col gap-3">
        {exercise.questions.map((question, index) => (
          <li key={question.id}>
            <KeyCard question={question} index={index} exercise={exercise} onChange={onChange} />
          </li>
        ))}
      </ul>

      <p className="flex items-start gap-2 rounded-lg bg-subtle p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t('shortAnswer.step2.tip')}</span>
      </p>
    </div>
  );
}

/** One question's key, everything on it recomputed from the grader on every keystroke. */
function KeyCard({
  question,
  index,
  exercise,
  onChange,
}: {
  question: Question;
  index: number;
  exercise: ShortAnswerDocument;
  onChange: (next: ShortAnswerDocument) => void;
}) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy(exercise);

  const usable = usableElements(question);
  const hasKey = usable.length > 0;
  const modelResult = grade(question, question.model, exercise.settings);
  const modelOk = modelPasses(question, exercise.settings);
  const flags = audit(question, exercise);

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-surface p-4 ${
        hasKey && !modelOk ? 'border-error' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid size-5 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
        >
          {index + 1}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm">
          {question.prompt.trim() === '' ? (
            <span className="text-muted-foreground">{t('shortAnswer.step2.untitled')}</span>
          ) : (
            question.prompt
          )}
        </p>
        {hasKey ? (
          <VerdictChip verdict={modelOk ? 'pass' : 'fail'} />
        ) : (
          <span className="shrink-0 rounded-full bg-(--ssz-bg-muted) px-2 py-0.5 text-[11px] text-muted-foreground">
            {t('shortAnswer.step2.noKey')}
          </span>
        )}
      </div>

      {/* The model answer, read-only. It is edited on step 1; here it is the reference the
          elements are written against, and an editable copy would invite the author to fix
          the answer to fit a key that is the thing being tested. */}
      <p className="text-xs text-muted-foreground">
        {t('shortAnswer.step2.modelLabel')}{' '}
        <span className="font-(family-name:--ssz-font-reading) text-(--ssz-text-secondary)">
          {question.model.trim() === '' ? '—' : question.model}
        </span>
      </p>

      {!hasKey && (
        <p className="text-xs text-error" role="status">
          {t('shortAnswer.issues.Q_NO_KEY_ANY')}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {question.elements.map((element, elementIndex) => (
          <li key={element.id}>
            <ElementRow
              element={element}
              index={elementIndex}
              question={question}
              exercise={exercise}
              hit={modelResult.hits.find((h) => h.id === element.id)?.anchor ?? null}
              flags={flags.filter((flag) => 'elementId' in flag && flag.elementId === element.id)}
              describeIssue={describeIssue}
              onChange={onChange}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={question.elements.length >= MAX_ELEMENTS}
          onClick={() => onChange(addElement(exercise, question.id))}
        >
          <Plus className="size-4" aria-hidden />
          {t('shortAnswer.step2.addElement')}
        </Button>
        {/* Warn-level, and it belongs beside the button that causes it rather than only in
            the gate: five elements is an essay question wearing a short answer's clothes. */}
        {flags.some((flag) => flag.code === 'Q_TOO_MANY_ELEMENTS') && (
          <p className="text-xs text-warning-700" role="status">
            {describeIssue(flags.find((flag) => flag.code === 'Q_TOO_MANY_ELEMENTS')!)}
          </p>
        )}
      </div>

      {hasKey && !modelOk && (
        <p
          className="flex items-start gap-2 rounded-lg border border-error/40 bg-(--ssz-color-error-50) p-3 text-xs text-error"
          role="status"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {t('shortAnswer.step2.modelFails', {
              covered: modelResult.covered,
              total: modelResult.total,
            })}
          </span>
        </p>
      )}

      <Tester question={question} exercise={exercise} />
    </div>
  );
}

/**
 * One element: what the answer must say, and the phrasings that count as saying it.
 *
 * The row turns green the moment the model answer covers it — that is the author's whole
 * feedback loop, and it is why the anchors are typed here rather than in a dialog.
 */
function ElementRow({
  element,
  index,
  question,
  exercise,
  hit,
  flags,
  describeIssue,
  onChange,
}: {
  element: KeyElement;
  index: number;
  question: Question;
  exercise: ShortAnswerDocument;
  /** The phrase of this element that the model answer contains, or `null`. */
  hit: string | null;
  flags: Issue[];
  describeIssue: (issue: Issue) => string;
  onChange: (next: ShortAnswerDocument) => void;
}) {
  const t = useTranslations('Authoring');

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 ${
        hit === null ? 'border-border' : 'border-success-500/50 bg-(--ssz-color-success-50)'
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className={`mt-1.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
            hit === null
              ? 'bg-(--ssz-bg-muted) text-(--ssz-text-secondary)'
              : 'bg-success-500 text-white'
          }`}
        >
          {index + 1}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input
            value={element.label}
            aria-label={t('shortAnswer.step2.elementLabel', { index: index + 1 })}
            placeholder={t('shortAnswer.step2.elementPlaceholder')}
            onChange={(event) =>
              onChange(setElement(exercise, question.id, element.id, { label: event.target.value }))
            }
          />
          <ChipEditor
            values={element.anchors}
            label={t('shortAnswer.step2.anchorsLabel', { index: index + 1 })}
            placeholder={t('shortAnswer.step2.anchorsPlaceholder')}
            removeLabel={(anchor) => t('shortAnswer.step2.removeAnchor', { anchor })}
            onAdd={(anchor) => onChange(addAnchor(exercise, question.id, element.id, anchor))}
            onRemove={(anchor) => onChange(removeAnchor(exercise, question.id, element.id, anchor))}
          />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={question.elements.length <= 1}
            aria-label={t('shortAnswer.step2.removeElement', { index: index + 1 })}
            onClick={() => onChange(removeElement(exercise, question.id, element.id))}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
          <label
            className="flex items-center gap-1.5 text-xs"
            title={t('shortAnswer.step2.requiredHelp')}
          >
            <Checkbox
              checked={element.required}
              onCheckedChange={(checked) =>
                onChange(
                  setElement(exercise, question.id, element.id, { required: checked === true }),
                )
              }
            />
            {t('shortAnswer.step2.required')}
          </label>
        </div>
      </div>

      {/* The audit, under the element it is about. Warn and info alike: an observation about
          one line has nowhere else to go, and the gate carries only what blocks. */}
      {flags.map((flag) => (
        <p
          key={`${flag.code}-${'anchor' in flag ? flag.anchor : ''}`}
          className={`flex items-start gap-1.5 text-xs ${
            flag.level === 'warning' ? 'text-warning-700' : 'text-muted-foreground'
          }`}
        >
          {flag.level === 'warning' ? (
            <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          ) : (
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
          )}
          <span>{describeIssue(flag)}</span>
        </p>
      ))}

      {hit !== null && (
        <p className="flex items-center gap-1.5 text-xs text-success-700">
          <Check className="size-3 shrink-0" aria-hidden />
          {t('shortAnswer.step2.modelCovers', { anchor: hit })}
        </p>
      )}
    </div>
  );
}

/**
 * Try a student answer — the loop the teacher actually iterates in.
 *
 * Scratch state, never persisted (IMPLEMENTATION.md §4): what is typed here is a guess at
 * how a student will word it, and storing guesses on the exercise would put them in front
 * of a student one day. It runs the real grader, so a phrase that fails here fails in the
 * player — which is the point, and the cheapest way to discover that an anchor is written
 * the way the teacher speaks rather than the way the class does.
 */
function Tester({ question, exercise }: { question: Question; exercise: ShortAnswerDocument }) {
  const t = useTranslations('Authoring');
  const [text, setText] = useState('');
  const result: QuestionResult | null =
    text.trim() === '' ? null : grade(question, text, exercise.settings);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
      <label
        className="flex items-center gap-1.5 text-xs font-medium"
        htmlFor={`sa-test-${question.id}`}
      >
        <Wand2 className="size-3.5" aria-hidden />
        {t('shortAnswer.step2.testerLabel')}
      </label>
      <Textarea
        id={`sa-test-${question.id}`}
        value={text}
        rows={2}
        placeholder={t('shortAnswer.step2.testerPlaceholder')}
        onChange={(event) => setText(event.target.value)}
      />
      {result !== null && (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <VerdictChip verdict={result.verdict} />
          {result.tooShort && (
            <span className="inline-flex items-center gap-1 rounded-full bg-(--ssz-color-warning-50) px-2 py-0.5 text-[11px] text-warning-700">
              <TriangleAlert className="size-3" aria-hidden />
              {t('shortAnswer.step2.testerTooShort')}
            </span>
          )}
          {result.hits.map((hitRow) => (
            <span
              key={hitRow.id}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                hitRow.anchor === null
                  ? 'bg-(--ssz-bg-muted) text-muted-foreground'
                  : 'bg-(--ssz-color-success-50) text-success-700'
              }`}
            >
              {hitRow.anchor === null ? (
                <X className="size-3" aria-hidden />
              ) : (
                <Check className="size-3" aria-hidden />
              )}
              {hitRow.anchor === null
                ? hitRow.label
                : t('shortAnswer.step2.testerHit', { label: hitRow.label, anchor: hitRow.anchor })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const VERDICT_TONE: Record<Verdict, string> = {
  pass: 'bg-(--ssz-color-success-50) text-success-700',
  partial: 'bg-(--ssz-color-warning-50) text-warning-700',
  fail: 'bg-(--ssz-color-error-50) text-error',
};

/** The teacher-side verdict chip: an icon and a word, never a colour on its own. */
function VerdictChip({ verdict }: { verdict: Verdict }) {
  const t = useTranslations('Authoring');
  const Icon = verdict === 'pass' ? Check : verdict === 'partial' ? Info : X;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT_TONE[verdict]}`}
    >
      <Icon className="size-3" aria-hidden />
      {t(`shortAnswer.verdict.${verdict}` as 'shortAnswer.verdict.pass')}
    </span>
  );
}
