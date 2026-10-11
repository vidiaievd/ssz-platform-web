'use client';

import { useState } from 'react';
import { ArrowRight, Check, CircleAlert, ClipboardList, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useContainerWidth } from '@/hooks';
import {
  AudioGateScreen,
  AudioLockNote,
  AudioTranscript,
  ExerciseAudioPlayer,
  type ExerciseAudioEngine,
} from '@/features/student/exercises/audio';
import type { StudentProjection } from '@/lib/shared-kernel/information-transfer';
import type { InformationTransferSubmitDetails } from '@/features/student/exercises/types/attempts';

import { InformationTransferCell } from './information-transfer-cell';
import { Instr } from './instr';

/**
 * Where the runner is. `checked` is the screen after a check; a retry returns to `answering`
 * with the wrong cells cleared. There is no `done`: navigation belongs to the player (plan 73,
 * deviation 19).
 */
export type InformationTransferPhase = 'answering' | 'checked';

export type InformationTransferLayout = 'phone' | 'desktop';

/** `fieldId → what was typed`. An empty cell is simply absent. */
export type InformationTransferValues = Record<string, string>;

/** Where the two-column cell gives way to one column. */
const WIDE_AT = 520;
const TAP_MIN = 44;
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

export interface InformationTransferBodyProps {
  /** The blank as the server dealt it: no key, no reasons, no pass mark. */
  projection: StudentProjection;
  /** The exercise's title, from the lesson item — the projection carries its own. */
  title?: string;
  /** Replaces the author's instruction line, which the reader translates per learner. */
  instruction?: string;
  values: InformationTransferValues;
  onValueChange: (fieldId: string, value: string) => void;
  phase: InformationTransferPhase;
  /** What the last check said. `null` before the first one and again after a retry. */
  verdict: InformationTransferSubmitDetails | null;
  /**
   * Cells the server froze, cumulative. A prop of its own rather than a field of `verdict`,
   * because it outlives it: a retry drops the marks and keeps the freeze (plan 54's lesson).
   */
  locked?: string[];
  /** The check the blank is on, 1-based — one past the last when a retry has been made. */
  attempt: number;
  sending?: boolean;
  error?: string | null;
  /** False in a preview: everything renders, nothing accepts input. */
  interactive?: boolean;
  /** Forces a layout — the builder preview's phone/desktop switch, and tests (jsdom measures 0). */
  layout?: InformationTransferLayout;
  onCheck: () => void;
  onRetry: () => void;
  /** «Ny runde» — a new attempt after the blank closes. */
  onNewRound: () => void;
  accent: string;
  /** The listening layer, mounted once by whoever owns the document (plan 56). */
  audio?: ExerciseAudioEngine;
  audioTranscript?: { transcript: string; translation: string } | null;
}

/**
 * `information_transfer`, as the learner plays it: a source and a blank to fill from it
 * (plan 73 §7.9).
 *
 * Controlled, and it owns nothing about the outcome. Which cell is right, which are frozen,
 * whether the blank is closed, the score and the pass mark are the server's: nothing here
 * knows a key, so there is no branch that could mark a cell right before a check. What it does
 * own is presentation — the step of a `oneAtATime` walk, whether the audio gate has been
 * passed, and the layout.
 */
export function InformationTransferBody({
  projection,
  title,
  instruction,
  values,
  onValueChange,
  phase,
  verdict,
  locked = [],
  attempt,
  sending = false,
  error = null,
  interactive = true,
  layout,
  onCheck,
  onRetry,
  onNewRound,
  accent,
  audio,
  audioTranscript = null,
}: InformationTransferBodyProps) {
  const t = useTranslations('ExerciseRunner.informationTransfer');
  const [root, width] = useContainerWidth();
  const [step, setStep] = useState(0);
  const [entered, setEntered] = useState(false);

  const { fields, answering } = projection;
  const wide = (layout ?? (width >= WIDE_AT ? 'desktop' : 'phone')) === 'desktop';
  const stacked = !wide || projection.form.layout === 'table';

  const audioOn = audio !== undefined && audio.audio.enabled;
  const audioLocked = audioOn && audio.gated;
  const canEdit = interactive && phase === 'answering' && !sending && !audioLocked;

  const lockedSet = new Set(locked);
  const outcomes = new Map((verdict?.items ?? []).map((item) => [item.itemId, item]));
  const total = fields.length;
  const filled = fields.filter((f) => (values[f.id] ?? '').trim() !== '').length;
  // Frozen cells are filled and need no check; the button is for what has changed.
  const checkable = fields.some((f) => !lockedSet.has(f.id) && (values[f.id] ?? '').trim() !== '');
  const closed = verdict?.closed === true;
  const wrong = verdict === null ? 0 : verdict.items.filter((item) => !item.correct).length;

  if (audioOn && audio.audio.settings.layout === 'gate' && !entered && verdict === null) {
    return (
      <div ref={root}>
        <AudioGateScreen eng={audio} interactive={interactive} onStart={() => setEntered(true)} />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div
        ref={root}
        className="flex flex-col items-center gap-1 rounded-2xl px-6 py-10 text-center"
        style={{ border: '1.5px dashed var(--ssz-border-default)' }}
      >
        <ClipboardList size={20} aria-hidden="true" className="text-(--ssz-text-muted)" />
        <p className="text-[14px] font-semibold text-(--ssz-text-primary)">{t('empty.title')}</p>
        <p className="text-[12.5px] text-(--ssz-text-muted)">{t('empty.body')}</p>
      </div>
    );
  }

  // One cell at a time is a way into the first check only; a retry and a reload show it all.
  const walking =
    answering.oneAtATime && verdict === null && attempt === 1 && phase === 'answering';
  const at = Math.min(step, total - 1);
  const shown = walking ? [fields[at]!] : fields;
  const lastStep = at === total - 1;

  const progress = verdict !== null ? verdict.correctNow : filled;
  const heading = title !== undefined && title.trim() !== '' ? title : projection.title;
  const line =
    instruction !== undefined && instruction !== ''
      ? instruction
      : projection.instruction !== ''
        ? projection.instruction
        : t('defaultInstruction');

  return (
    <div ref={root} data-layout={wide ? 'desktop' : 'phone'} className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 shrink-0 text-[11px] text-(--ssz-text-muted)">
          {heading !== '' ? heading : t('defaultTitle')}
        </span>
        <div
          role="progressbar"
          aria-label={t('progress')}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={progress}
          className="h-1.5 flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--ssz-bg-subtle)' }}
        >
          <i
            className="block h-full"
            style={{ width: `${(progress / total) * 100}%`, background: accent }}
          />
        </div>
        <span className="text-[11px] tabular-nums text-(--ssz-text-muted)">
          {progress}/{total}
        </span>
      </div>

      <Instr>{line}</Instr>

      {projection.sourceKind === 'audio' ? (
        audioOn && (
          <div>
            <ExerciseAudioPlayer eng={audio} interactive={interactive} tone="quiet" />
            {audioLocked && <AudioLockNote />}
          </div>
        )
      ) : (
        <div
          className="flex flex-col gap-1.5 rounded-(--ssz-radius-md) border p-(--ssz-space-4)"
          style={{
            borderColor: 'var(--ssz-border-default)',
            background: 'var(--ssz-bg-subtle)',
          }}
        >
          {projection.passageTitle !== undefined && projection.passageTitle !== '' && (
            <h5 className="m-0 text-xs font-semibold uppercase tracking-wide text-(--ssz-text-muted)">
              {projection.passageTitle}
            </h5>
          )}
          <pre
            className="m-0 whitespace-pre-wrap text-sm leading-relaxed"
            style={{ fontFamily: 'var(--ssz-font-reading)' }}
            lang={projection.language || undefined}
          >
            {projection.passage}
          </pre>
        </div>
      )}

      {/* Always mounted so the announcement is made when the verdict arrives, not when the
          region appears. */}
      <div aria-live="polite">{verdict !== null && <Score verdict={verdict} total={total} />}</div>

      <section
        aria-label={projection.form.formTitle !== '' ? projection.form.formTitle : t('form')}
        className="flex flex-col gap-2.5 rounded-(--ssz-radius-md) border p-(--ssz-space-4)"
        style={{
          borderColor: 'var(--ssz-border-strong)',
          background: 'var(--ssz-bg-surface)',
        }}
      >
        <div
          className="flex items-center gap-2 border-b pb-[9px]"
          style={{ borderColor: 'var(--ssz-border-default)' }}
        >
          <ClipboardList size={15} aria-hidden="true" />
          <strong className="text-sm">
            {projection.form.formTitle !== '' ? projection.form.formTitle : t('form')}
          </strong>
          <span className="flex-1" />
          {walking && (
            <span className="text-xs text-(--ssz-text-muted)">
              {t('stepOf', { k: at + 1, n: total })}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-[9px]">
          {shown.map((field) => (
            <InformationTransferCell
              key={field.id}
              field={field}
              position={fields.indexOf(field) + 1}
              language={projection.language}
              value={values[field.id] ?? ''}
              onChange={(value) => onValueChange(field.id, value)}
              {...(outcomes.has(field.id) ? { outcome: outcomes.get(field.id)! } : {})}
              locked={lockedSet.has(field.id)}
              canEdit={canEdit}
              stacked={stacked}
              {...(audio === undefined ? {} : { audio })}
              interactive={interactive}
            />
          ))}
        </div>
      </section>

      {verdict !== null && !verdict.passed && answering.revealKey === 'never' && (
        <p
          role="note"
          className="m-0 flex items-start gap-2 rounded-(--ssz-radius-sm) px-3 py-2.5 text-sm"
          style={{
            background: 'var(--ssz-feedback-key-bg)',
            color: 'var(--ssz-feedback-key-fg)',
          }}
        >
          <CircleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
          {t('noKey')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {phase === 'answering' ? (
          walking && !lastStep ? (
            <ActionButton
              accent={accent}
              disabled={!interactive || audioLocked}
              onClick={() => setStep(at + 1)}
            >
              {t('next')}
              <ArrowRight size={14} aria-hidden="true" />
            </ActionButton>
          ) : (
            <ActionButton
              accent={accent}
              disabled={!interactive || sending || audioLocked || !checkable}
              onClick={onCheck}
            >
              <Check size={14} aria-hidden="true" />
              {sending ? t('checking') : t('check')}
            </ActionButton>
          )
        ) : closed ? (
          <ActionButton accent={accent} disabled={!interactive || sending} onClick={onNewRound}>
            <RefreshCw size={14} aria-hidden="true" />
            {t('newRound')}
          </ActionButton>
        ) : (
          wrong > 0 && (
            <ActionButton accent={accent} disabled={!interactive || sending} onClick={onRetry}>
              <RefreshCw size={14} aria-hidden="true" />
              {answering.attempts > 0
                ? t('retry', {
                    n: wrong,
                    k: (verdict?.attempt ?? attempt) + 1,
                    max: answering.attempts,
                  })
                : t('retryUnlimited', { n: wrong })}
            </ActionButton>
          )
        )}
      </div>

      {error !== null && (
        <p
          className="m-0 flex items-start gap-1.5 text-[12.5px]"
          style={{ color: 'var(--ssz-feedback-no-fg)' }}
        >
          <CircleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {audioOn && (
        <AudioTranscript
          audio={audio.audio}
          revealed={audioTranscript !== null}
          delivered={audioTranscript}
        />
      )}
    </div>
  );
}

/** The recorded score — the first check's, from the server (deviations 14 and 15). */
function Score({ verdict, total }: { verdict: InformationTransferSubmitDetails; total: number }) {
  const t = useTranslations('ExerciseRunner.informationTransfer');
  const pass = verdict.passed;
  // The prototype names the required cell only when «every required cell» is what failed a good
  // percentage. The projection does not carry that setting (and `missedRequired` counts the
  // cells whatever it is), so it is read off the verdict: failed, over the mark, a required miss.
  const requiredHeld = !pass && verdict.pct >= verdict.passPct && verdict.missedRequired > 0;
  return (
    <div
      className="flex flex-col items-center gap-1.5 rounded-(--ssz-radius-md) border px-(--ssz-space-4) py-(--ssz-space-5)"
      style={{
        borderColor: pass ? 'var(--ssz-color-success-500)' : 'var(--ssz-border-default)',
        background: pass ? 'var(--ssz-color-success-50)' : 'var(--ssz-bg-surface)',
      }}
    >
      <b className="text-3xl font-bold tabular-nums tracking-tight">
        {verdict.passedItems}
        <span className="text-lg font-normal text-(--ssz-text-muted)">/{total}</span>
      </b>
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
        style={{
          background: pass ? 'var(--ssz-color-success-500)' : 'var(--ssz-color-warning-500)',
        }}
      >
        {pass ? <Check size={13} aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />}
        {pass ? t('passed') : t('tryAgain')}
      </span>
      <span className="text-center text-xs text-(--ssz-text-secondary)">
        {t('scoreLine', { pct: verdict.pct, need: verdict.passPct })}
        {requiredHeld && ` · ${t('requiredMissed')}`}
      </span>
    </div>
  );
}

function ActionButton({
  accent,
  disabled,
  onClick,
  children,
}: {
  accent: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:pointer-events-none disabled:opacity-50 ${FOCUS}`}
      style={{ minHeight: TAP_MIN, background: accent }}
    >
      {children}
    </button>
  );
}
