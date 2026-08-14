'use client';

import { useTranslations } from 'next-intl';
import { Bot, Info, Target, User } from 'lucide-react';

import { Segmented } from '@/components/ui/segmented';
import {
  authoredItems,
  type Ai,
  type AiVisibility,
  type AttemptsPolicy,
  type Flow,
  type ShowRefsPolicy,
  type Translate,
} from '@/lib/shared-kernel/translate';

import { QueuePreview } from './queue-preview';
import { ToggleRow } from '../toggle-row';

/** Self-checks the student may spend before handing in — `flow.selfCheck` is 0–5. */
const SELF_CHECKS = [0, 1, 2, 3, 4, 5] as const;

const ATTEMPTS: AttemptsPolicy[] = ['free', 'once'];
const SHOW_REFS: ShowRefsPolicy[] = ['afterGraded', 'afterSubmit', 'never'];
const VISIBILITY: AiVisibility[] = ['teacher', 'studentBefore', 'studentAfter'];

const AI_CHECKS: (keyof Ai['checks'])[] = ['grammar', 'order', 'lexis', 'register'];

export interface StepFlowProps {
  exercise: Translate;
  onChange: (next: Translate) => void;
}

/**
 * Step 4 of the translate builder: the road from a handed-in set to a mark.
 *
 * The diagram is the point of the step. Three stages stand between an answer and a
 * verdict, and only the first and the last exist — so an author who has not seen it is an
 * author surprised by the size of their own queue. Unlike `error_correction`, which drops
 * the AI stage from its builder entirely, this template keeps it: here the teacher is not
 * a fallback but the only source of a negative verdict, and the AI stage is what will
 * eventually draft the comment they send. The switches write to `ai`, which the document
 * has carried since its first save; nothing calls a model, and every AI surface says so.
 */
export function StepFlow({ exercise, onChange }: StepFlowProps) {
  const t = useTranslations('Authoring');
  const { flow, ai, check } = exercise;

  const setFlow = (patch: Partial<Flow>) => onChange({ ...exercise, flow: { ...flow, ...patch } });
  const setAi = (patch: Partial<Ai>) => onChange({ ...exercise, ai: { ...ai, ...patch } });

  /** A switch for glosses nobody wrote would be a switch with nothing behind it. */
  const glossWritten = authoredItems(exercise).some((item) => item.gloss.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('translate.step4.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('translate.step4.lede')}</p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        <Stage
          step={1}
          icon={Target}
          off={!check.on}
          title={t('translate.step4.stageCheck')}
          detail={
            check.on
              ? check.exactPass
                ? t('translate.step4.stageCheckOn')
                : t('translate.step4.stageCheckNoPass')
              : t('translate.step4.stageCheckOff')
          }
        />
        <Stage
          step={2}
          icon={Bot}
          off={!ai.on}
          title={t('translate.step4.stageAi')}
          detail={t('translate.step4.stageAiDetail')}
          badge={t('translate.step4.aiInert')}
        />
        <Stage
          step={3}
          icon={User}
          title={t('translate.step4.stageTeacher')}
          detail={t('translate.step4.stageTeacherDetail')}
        />
      </ol>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <ToggleRow
          label={t('translate.step4.aiLabel')}
          help={t('translate.step4.aiHelp')}
          checked={ai.on}
          onChange={(value) => setAi({ on: value })}
        />
      </div>

      {ai.on && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-medium">{t('translate.step4.aiChecksLabel')}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {AI_CHECKS.map((aspect) => {
                const on = ai.checks[aspect];
                return (
                  <label
                    key={aspect}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${
                      on ? 'border-primary bg-primary-50' : 'border-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={on}
                      onChange={(event) =>
                        setAi({ checks: { ...ai.checks, [aspect]: event.target.checked } })
                      }
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {t(`translate.step4.ai.${aspect}` as 'translate.step4.ai.grammar')}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t(
                          `translate.step4.aiHelpFor.${aspect}` as 'translate.step4.aiHelpFor.grammar',
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium">{t('translate.step4.aiVisibilityLabel')}</h3>
            <Segmented
              aria-label={t('translate.step4.aiVisibilityLabel')}
              value={ai.visibility}
              onValueChange={(value) => setAi({ visibility: value })}
              options={VISIBILITY.map((who) => ({
                value: who,
                label: t(
                  `translate.step4.aiVisibility.${who}` as 'translate.step4.aiVisibility.teacher',
                ),
              }))}
            />
            <Explain>{t('translate.step4.aiVisibilityHelp')}</Explain>
          </section>
        </>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('translate.step4.studentGroup')}</h3>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <ToggleRow
            label={t('translate.step4.keyboardLabel')}
            help={t('translate.step4.keyboardHelp')}
            checked={flow.keyboard}
            onChange={(value) => setFlow({ keyboard: value })}
          />
          <ToggleRow
            label={t('translate.step4.glossLabel')}
            help={t('translate.step4.glossHelp')}
            checked={flow.gloss}
            disabledReason={glossWritten ? undefined : t('translate.step4.noGlossWritten')}
            onChange={(value) => setFlow({ gloss: value })}
          />
          <ToggleRow
            label={t('translate.step4.charCountLabel')}
            help={t('translate.step4.charCountHelp')}
            checked={flow.charCount}
            onChange={(value) => setFlow({ charCount: value })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('translate.step4.selfCheckLabel')}</h3>
        <Segmented
          aria-label={t('translate.step4.selfCheckLabel')}
          value={String(flow.selfCheck)}
          onValueChange={(value) => setFlow({ selfCheck: Number(value) })}
          options={SELF_CHECKS.map((count) => ({
            value: String(count),
            label: count === 0 ? t('translate.step4.selfCheckNone') : String(count),
          }))}
        />
        <Explain>
          {flow.selfCheck > 0
            ? t('translate.step4.selfCheckOn')
            : t('translate.step4.selfCheckOff')}
        </Explain>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('translate.step4.attemptsLabel')}</h3>
        <Segmented
          aria-label={t('translate.step4.attemptsLabel')}
          value={flow.attempts}
          onValueChange={(value) => setFlow({ attempts: value })}
          options={ATTEMPTS.map((policy) => ({
            value: policy,
            label: t(`translate.step4.attempts.${policy}` as 'translate.step4.attempts.free'),
          }))}
        />
        <Explain>
          {t(
            `translate.step4.attemptsHelp.${flow.attempts}` as 'translate.step4.attemptsHelp.free',
          )}
        </Explain>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('translate.step4.showRefsLabel')}</h3>
        <Segmented
          aria-label={t('translate.step4.showRefsLabel')}
          value={flow.showRefs}
          onValueChange={(value) => setFlow({ showRefs: value })}
          options={SHOW_REFS.map((policy) => ({
            value: policy,
            label: t(`translate.step4.showRefs.${policy}` as 'translate.step4.showRefs.never'),
          }))}
        />
        <Explain>
          {t(
            `translate.step4.showRefsHelp.${flow.showRefs}` as 'translate.step4.showRefsHelp.never',
          )}
        </Explain>
      </section>

      <QueuePreview exercise={exercise} />
    </div>
  );
}

interface StageProps {
  step: number;
  icon: typeof Target;
  title: string;
  detail: string;
  badge?: string;
  off?: boolean;
}

function Stage({ step, icon: Icon, title, detail, badge, off = false }: StageProps) {
  return (
    <li
      className={`flex flex-col gap-1 rounded-lg border border-border p-3 ${
        off ? 'opacity-50' : 'bg-surface'
      }`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {String(step).padStart(2, '0')}
      </span>
      <strong className="text-sm">{title}</strong>
      <span className="text-xs text-muted-foreground">{detail}</span>
      {badge !== undefined && (
        <span className="self-start rounded-full bg-[var(--ssz-bg-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
          {badge}
        </span>
      )}
    </li>
  );
}

function Explain({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
