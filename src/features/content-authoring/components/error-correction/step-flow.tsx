'use client';

import { useTranslations } from 'next-intl';
import { Info, Pencil, Target, User } from 'lucide-react';

import { Segmented } from '@/components/ui/segmented';
import type {
  AttemptsPolicy,
  ErrorCorrection,
  Flow,
  ShowRefsPolicy,
} from '@/lib/shared-kernel/error-correction';

import { ToggleRow } from '../toggle-row';

/** Self-checks the student may spend before handing in. */
const SELF_CHECKS = [0, 1, 2, 3] as const;

const ATTEMPTS: AttemptsPolicy[] = ['free', 'once'];
const SHOW_REFS: ShowRefsPolicy[] = ['afterGraded', 'afterSubmit', 'never'];

export interface StepFlowProps {
  exercise: ErrorCorrection;
  onChange: (next: ErrorCorrection) => void;
}

/**
 * Step 4: the road from handing in to a mark.
 *
 * The diagram at the top is the point of the step rather than decoration. The automatic
 * check can only ever approve — everything it does not settle lands on a teacher — and an
 * author who has not seen that is an author surprised by their own queue. It is inert:
 * the stages report what the settings on steps 3 and 4 already say.
 *
 * The AI stage the handoff draws is deliberately absent (plan 41, "Отложено"). The model
 * carries `ai` from its first commit, so wiring one up later needs no migration, but a
 * screen full of switches for something not connected would promise what it cannot do.
 */
export function StepFlow({ exercise, onChange }: StepFlowProps) {
  const t = useTranslations('Authoring');
  const { flow, check } = exercise;

  const setFlow = (patch: Partial<Flow>) => onChange({ ...exercise, flow: { ...flow, ...patch } });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('errorCorrection.step4.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('errorCorrection.step4.lede')}</p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        <Stage
          step={1}
          icon={Pencil}
          title={t('errorCorrection.step4.stageStudent')}
          detail={
            flow.selfCheck > 0
              ? t('errorCorrection.step4.stageStudentChecks', { count: flow.selfCheck })
              : t('errorCorrection.step4.stageStudentBlind')
          }
        />
        <Stage
          step={2}
          icon={Target}
          off={!check.on}
          title={t('errorCorrection.step4.stageCheck')}
          detail={
            check.on
              ? t('errorCorrection.step4.stageCheckOn')
              : t('errorCorrection.step4.stageCheckOff')
          }
        />
        <Stage
          step={3}
          icon={User}
          title={t('errorCorrection.step4.stageTeacher')}
          detail={t('errorCorrection.step4.stageTeacherDetail')}
        />
      </ol>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('errorCorrection.step4.selfCheckLabel')}</h3>
        <Segmented
          aria-label={t('errorCorrection.step4.selfCheckLabel')}
          value={String(flow.selfCheck)}
          onValueChange={(value) => setFlow({ selfCheck: Number(value) })}
          options={SELF_CHECKS.map((count) => ({
            value: String(count),
            label:
              count === 0
                ? t('errorCorrection.step4.selfCheckNone')
                : t('errorCorrection.step4.selfCheckTimes', { count }),
          }))}
        />
        <Explain>
          {flow.selfCheck > 0
            ? t('errorCorrection.step4.selfCheckOn')
            : t('errorCorrection.step4.selfCheckOff')}
        </Explain>
      </section>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <ToggleRow
          label={t('errorCorrection.step4.showSpanCountLabel')}
          help={t('errorCorrection.step4.showSpanCountHelp')}
          checked={flow.showSpanCount}
          // Without a self-check there is no moment at which this could be shown.
          disabledReason={flow.selfCheck > 0 ? undefined : t('errorCorrection.step4.noSelfCheck')}
          onChange={(value) => setFlow({ showSpanCount: value })}
        />
        <ToggleRow
          label={t('errorCorrection.step4.keyboardLabel')}
          help={t('errorCorrection.step4.keyboardHelp')}
          checked={flow.keyboard}
          onChange={(value) => setFlow({ keyboard: value })}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('errorCorrection.step4.attemptsLabel')}</h3>
        <Segmented
          aria-label={t('errorCorrection.step4.attemptsLabel')}
          value={flow.attempts}
          onValueChange={(value) => setFlow({ attempts: value })}
          options={ATTEMPTS.map((policy) => ({
            value: policy,
            label: t(
              `errorCorrection.step4.attempts.${policy}` as 'errorCorrection.step4.attempts.free',
            ),
          }))}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('errorCorrection.step4.showRefsLabel')}</h3>
        <Segmented
          aria-label={t('errorCorrection.step4.showRefsLabel')}
          value={flow.showRefs}
          onValueChange={(value) => setFlow({ showRefs: value })}
          options={SHOW_REFS.map((policy) => ({
            value: policy,
            label: t(
              `errorCorrection.step4.showRefs.${policy}` as 'errorCorrection.step4.showRefs.never',
            ),
          }))}
        />
        <Explain>
          {t(
            `errorCorrection.step4.showRefsHelp.${flow.showRefs}` as 'errorCorrection.step4.showRefsHelp.never',
          )}
        </Explain>
      </section>
    </div>
  );
}

interface StageProps {
  step: number;
  icon: typeof Pencil;
  title: string;
  detail: string;
  off?: boolean;
}

function Stage({ step, icon: Icon, title, detail, off = false }: StageProps) {
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
