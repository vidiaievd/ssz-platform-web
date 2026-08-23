'use client';

import { useTranslations } from 'next-intl';

import { Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  issues,
  type PassRule,
  type Question,
  type ShowModelPolicy,
} from '@/lib/shared-kernel/short-answer';

import { setQuestion, setSettings, type ShortAnswerDocument } from './edits';
import { ToggleRow } from '../toggle-row';

const PASS_RULES: PassRule[] = ['all', 'n'];
const PASS_N = ['1', '2', '3'];
/** Off, then a few words, a sentence, and a short paragraph. */
const MIN_WORDS = ['0', '3', '6', '12'];
const SHOW_MODEL: ShowModelPolicy[] = ['onClose', 'always', 'never'];

export interface StepVerdictProps {
  exercise: ShortAnswerDocument;
  onChange: (next: ShortAnswerDocument) => void;
}

/**
 * Step 3: what counts as a pass, and what the student reads the moment they submit.
 *
 * Every setting here is exercise-wide — the handoff has no per-question overrides — with
 * one exception, and it is the important one: `why`, the sentence shown under every
 * verdict, is written per question and is a blocker while it is missing. A verdict without
 * it is a mark; with it, it is teaching, which is the only reason this template hands a
 * student anything at all before a teacher has looked.
 *
 * The length rule is worth reading twice: an answer under `minWords` is **flagged**, never
 * failed, and the student is shown no counter. That is the handoff's decision stated in as
 * many words — a counter would turn a question about understanding into a question about
 * length.
 */
export function StepVerdict({ exercise, onChange }: StepVerdictProps) {
  const t = useTranslations('Authoring');
  const s = exercise.settings;
  const passNTooHigh = issues(exercise).some((issue) => issue.code === 'PASS_N_TOO_HIGH');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('shortAnswer.step3.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('shortAnswer.step3.lede')}</p>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-md">
            <p className="text-sm">{t('shortAnswer.step3.passRuleLabel')}</p>
            <p className="text-xs text-muted-foreground">{t('shortAnswer.step3.passRuleHelp')}</p>
          </div>
          <Segmented<PassRule>
            aria-label={t('shortAnswer.step3.passRuleLabel')}
            value={s.passRule}
            onValueChange={(passRule) => onChange(setSettings(exercise, { passRule }))}
            options={PASS_RULES.map((rule) => ({
              value: rule,
              label: t(`shortAnswer.step3.passRule_${rule}` as 'shortAnswer.step3.passRule_all'),
            }))}
          />
        </div>

        {s.passRule === 'n' && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-md">
              <p className="text-sm">{t('shortAnswer.step3.passNLabel')}</p>
              {/* The warning belongs here, beside the number that causes it: a question with
                  two elements can never be passed by a rule asking for three, and the gate
                  is too late to learn that about a document you are still writing. */}
              <p
                className={`text-xs ${passNTooHigh ? 'text-warning-700' : 'text-muted-foreground'}`}
              >
                {passNTooHigh
                  ? t('shortAnswer.issues.PASS_N_TOO_HIGH', { passN: s.passN })
                  : t('shortAnswer.step3.passNHelp')}
              </p>
            </div>
            <Segmented<string>
              aria-label={t('shortAnswer.step3.passNLabel')}
              value={String(s.passN)}
              onValueChange={(value) => onChange(setSettings(exercise, { passN: Number(value) }))}
              options={PASS_N.map((n) => ({ value: n, label: n }))}
            />
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-md">
            <p className="text-sm">{t('shortAnswer.step3.minWordsLabel')}</p>
            <p className="text-xs text-muted-foreground">{t('shortAnswer.step3.minWordsHelp')}</p>
          </div>
          <Segmented<string>
            aria-label={t('shortAnswer.step3.minWordsLabel')}
            value={String(s.minWords)}
            onValueChange={(value) => onChange(setSettings(exercise, { minWords: Number(value) }))}
            options={MIN_WORDS.map((words) => ({
              value: words,
              label:
                words === '0'
                  ? t('shortAnswer.step3.minWordsOff')
                  : t('shortAnswer.step3.minWordsN', { count: Number(words) }),
            }))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <ToggleRow
          label={t('shortAnswer.step3.typosLabel')}
          help={t('shortAnswer.step3.typosHelp')}
          checked={s.typos}
          onChange={(typos) => onChange(setSettings(exercise, { typos }))}
        />
        <ToggleRow
          label={t('shortAnswer.step3.breakdownLabel')}
          help={t('shortAnswer.step3.breakdownHelp')}
          checked={s.showBreakdown}
          onChange={(showBreakdown) => onChange(setSettings(exercise, { showBreakdown }))}
        />
        <ToggleRow
          label={t('shortAnswer.step3.progressLabel')}
          help={t('shortAnswer.step3.progressHelp')}
          checked={s.progress}
          onChange={(progress) => onChange(setSettings(exercise, { progress }))}
        />
      </section>

      <section className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="max-w-md">
          <p className="text-sm">{t('shortAnswer.step3.showModelLabel')}</p>
          <p className="text-xs text-muted-foreground">{t('shortAnswer.step3.showModelHelp')}</p>
        </div>
        <Segmented<ShowModelPolicy>
          aria-label={t('shortAnswer.step3.showModelLabel')}
          value={s.showModel}
          onValueChange={(showModel) => onChange(setSettings(exercise, { showModel }))}
          options={SHOW_MODEL.map((policy) => ({
            value: policy,
            label: t(
              `shortAnswer.step3.showModel_${policy}` as 'shortAnswer.step3.showModel_onClose',
            ),
          }))}
        />
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h3 className="text-xs font-medium">{t('shortAnswer.step3.whySection')}</h3>
          <p className="text-xs text-muted-foreground">{t('shortAnswer.step3.whySectionHelp')}</p>
        </div>

        <ul className="flex flex-col gap-3">
          {exercise.questions.map((question, index) => (
            <li key={question.id}>
              <WhyCard question={question} index={index} exercise={exercise} onChange={onChange} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** One question's explanation — shown under every verdict, right, partial or wrong. */
function WhyCard({
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
  const noWhy = question.why.trim() === '';

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border bg-surface p-4 ${
        noWhy ? 'border-error' : 'border-border'
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
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`sa-why-${question.id}`}>
          {t('shortAnswer.step3.whyLabel')}
        </label>
        <Textarea
          id={`sa-why-${question.id}`}
          aria-describedby={`sa-why-help-${question.id}`}
          value={question.why}
          rows={2}
          hasError={noWhy}
          aria-invalid={noWhy}
          placeholder={t('shortAnswer.step3.whyPlaceholder')}
          onChange={(event) =>
            onChange(setQuestion(exercise, question.id, { why: event.target.value }))
          }
        />
        <p
          id={`sa-why-help-${question.id}`}
          className={`text-xs ${noWhy ? 'text-error' : 'text-muted-foreground'}`}
        >
          {noWhy ? t('shortAnswer.issues.Q_NO_WHY_ANY') : t('shortAnswer.step3.whyHelp')}
        </p>
      </div>
    </div>
  );
}
