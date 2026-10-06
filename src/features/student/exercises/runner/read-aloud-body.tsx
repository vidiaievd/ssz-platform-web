'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert, Headphones, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useContainerWidth } from '@/hooks';
import { ExerciseAudioPlayer, type ExerciseAudioEngine } from '@/features/student/exercises/audio';
import type { RecorderHandle } from '@/features/student/exercises/recorder';
import {
  chosenIndex,
  clockSeconds,
  clockWarns,
  COUNTDOWN_SECONDS,
  formatSeconds,
  isShort,
  left,
  micOk,
  micSilent,
  recordedCount,
  recordedShare,
  shortOnes,
  submitBlock,
  takesOf,
  type RecorderConfig,
  type StudentProjection,
  type SubmittedRecording,
} from '@/lib/shared-kernel/read-aloud';

import {
  Clock,
  Material,
  Meter,
  RA_CAPS,
  RA_FOCUS,
  RecHead,
  RecHeadAside,
  ReviewSteps,
  RubricGuide,
  TakeNumber,
  TakePlayer,
  takeRowStyle,
  type TakeSource,
} from './read-aloud-parts';

export type ReadAloudLayout = 'phone' | 'desktop';
export type ReadAloudStage = 'draft' | 'sent' | 'graded';

/** Wider than a phone frame: the body centres itself and breathes. */
const DESKTOP_AT = 560;

export interface ReadAloudBodyProps {
  projection: StudentProjection;
  /** The machine and its hardware — `useRecorder` over the kernel's reducer. */
  recorder: RecorderHandle;
  config: RecorderConfig;
  /** The exercise's title, from the lesson item; the projection's own otherwise. */
  title?: string;
  /** Replaces the author's instruction line, which the reader translates per learner. */
  instruction?: string;
  stage: ReadAloudStage;
  /** Where a take can be heard from — by its `blob:` URL before the upload, its asset after. */
  sourceOf: (ref: string | null, assetId: string | null) => TakeSource;
  /** What was handed in, for the players after sending. */
  submitted?: readonly SubmittedRecording[];
  /** The teacher's verdict, drawn under the handed-in takes in `graded`. */
  graded?: ReactNode;
  onSubmit: () => void;
  onRetryUpload: (itemId: string, n: number) => void;
  submitting?: boolean;
  error?: string | null;
  /** False in a static preview: everything renders, nothing accepts input. */
  interactive?: boolean;
  /** Forces a layout — the builder preview's phone/desktop switch, and tests (jsdom measures 0). */
  layout?: ReadAloudLayout;
  accent: string;
  /** The model reading or the partner's line — the audio layer, never a second way (RA-R9). */
  audio?: ExerciseAudioEngine;
}

/**
 * `read_aloud`, as the learner records it — the prototype's `Runner` (plan 70 §7.9).
 *
 * Controlled, and it decides nothing: which phase the recorder is in, which take is chosen,
 * whether the hand-in is allowed and why not are the kernel's (`recorder.ts`), read here
 * through its selectors. Nothing on this screen scores speech (README idea 3); after sending
 * there is only «hos læreren» until a person has listened.
 *
 * One column on every device, as in the prototype; on a wide screen it centres itself. The
 * mode changes only the material above the recorder (README «What the type is for»).
 */
export function ReadAloudBody({
  projection,
  recorder,
  config,
  title,
  instruction,
  stage,
  sourceOf,
  submitted = [],
  graded,
  onSubmit,
  onRetryUpload,
  submitting = false,
  error = null,
  interactive = true,
  layout,
  accent,
  audio,
}: ReadAloudBodyProps) {
  const t = useTranslations('ExerciseRunner.readAloud');
  const [root, width] = useContainerWidth();
  const wide = (layout ?? (width >= DESKTOP_AT ? 'desktop' : 'phone')) === 'desktop';

  const { state } = recorder;
  const prompts = projection.prompts;
  const prompt = prompts[state.index];
  const heading = title?.trim() || projection.title.trim() || t('defaultTitle');
  const shown = instruction?.trim() || projection.instruction.trim() || t('defaultInstruction');
  const audioOn = audio !== undefined && audio.audio.enabled;
  const labelOf = (id: string) => {
    const i = prompts.findIndex((p) => p.id === id);
    return prompts[i]?.label.trim() || t('promptN', { n: i + 1 });
  };

  if (prompt === undefined) {
    return (
      <div ref={root} className="p-(--ssz-space-4) text-sm text-(--ssz-text-muted)">
        {t('noPrompts')}
      </div>
    );
  }

  const recorded = recordedCount(state, config);

  return (
    <div
      ref={root}
      className="flex w-full flex-col gap-(--ssz-space-4)"
      style={wide ? { maxWidth: 680, marginInline: 'auto' } : undefined}
    >
      {/* wb-run-top */}
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 truncate text-xs text-(--ssz-text-muted)">{heading}</span>
        <div
          className="h-1 flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--ssz-bg-muted)' }}
          role="progressbar"
          aria-label={t('progress')}
          aria-valuemin={0}
          aria-valuemax={prompts.length}
          aria-valuenow={recorded}
        >
          <i
            className="block h-full"
            style={{
              width: `${(recorded / prompts.length) * 100}%`,
              background: 'var(--ssz-color-primary-500)',
              transition: 'width var(--ssz-duration-slow) var(--ssz-ease-out)',
            }}
          />
        </div>
        <span className="text-xs tabular-nums text-(--ssz-text-muted)">
          {state.index + 1}/{prompts.length}
        </span>
      </div>
      <p className="m-0 text-sm text-(--ssz-text-secondary)">{shown}</p>

      {stage === 'draft' ? (
        <>
          {audioOn && <ExerciseAudioPlayer eng={audio} tone="quiet" interactive={interactive} />}
          {projection.rubric !== undefined && <RubricGuide criteria={projection.rubric} />}

          {prompts.length > 1 && prompt.label.trim() !== '' && (
            <span className={`text-(--ssz-text-muted) ${RA_CAPS}`}>{prompt.label}</span>
          )}
          <Material mode={projection.mode} prompt={prompt} language={projection.language} />

          <RecorderBlock
            recorder={recorder}
            config={config}
            mode={projection.mode}
            interactive={interactive}
            sourceOf={sourceOf}
            onRetryUpload={onRetryUpload}
          />

          {prompts.length > 1 && (
            <div className="flex items-center">
              <NavButton
                disabled={state.index === 0 || !interactive}
                onClick={() => recorder.goto(state.index - 1)}
                icon={<ArrowLeft size={14} aria-hidden="true" />}
              >
                {t('prev')}
              </NavButton>
              <span className="flex-1" />
              <NavButton
                disabled={state.index >= prompts.length - 1 || !interactive}
                onClick={() => recorder.goto(state.index + 1)}
                iconRight={<ArrowRight size={14} aria-hidden="true" />}
              >
                {t('next')}
              </NavButton>
            </div>
          )}

          <SubmitActions
            recorder={recorder}
            config={config}
            labelOf={labelOf}
            interactive={interactive}
            submitting={submitting}
            error={error}
            onSubmit={onSubmit}
            accent={accent}
          />
        </>
      ) : (
        <>
          <ReviewSteps graded={stage === 'graded'} />
          {submitted.map((r, i) => (
            <div key={r.itemId} className="flex items-center gap-2.5" style={takeRowStyle(false)}>
              <TakeNumber n={i + 1} />
              <TakePlayer
                source={sourceOf(null, r.assetId)}
                seconds={r.seconds}
                label={t('submittedTake', { label: labelOf(r.itemId) })}
                interactive={interactive}
              />
            </div>
          ))}
          {stage === 'sent' && (
            <div
              role="status"
              className="flex flex-col gap-2 rounded-(--ssz-radius-md) border p-(--ssz-space-4) text-sm"
              style={{
                background: 'var(--ssz-color-primary-50)',
                borderColor: 'var(--ssz-color-primary-200)',
                color: 'var(--ssz-color-primary-800)',
              }}
            >
              <p className="m-0">
                <b>{t('sent.title')}</b> {t('sent.body')}
              </p>
            </div>
          )}
          {stage === 'graded' && graded}
        </>
      )}
    </div>
  );
}

function NavButton({
  children,
  disabled,
  onClick,
  icon,
  iconRight,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
  icon?: ReactNode;
  iconRight?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-[7px] rounded-(--ssz-radius-sm) px-[13px] py-2 text-sm font-medium text-(--ssz-text-secondary) hover:bg-(--ssz-bg-subtle) disabled:opacity-45 ${RA_FOCUS}`}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

/** `ra-recbtn`: full width, 52px, red with a white dot — or the stop and ghost variants. */
function RecButton({
  children,
  variant = 'rec',
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  variant?: 'rec' | 'stop' | 'ghost';
  disabled?: boolean;
  onClick: () => void;
}) {
  const look =
    variant === 'stop'
      ? { background: 'var(--ssz-color-neutral-900)', color: '#fff', border: 'none' }
      : variant === 'ghost'
        ? {
            background: 'var(--ssz-bg-subtle)',
            color: 'var(--ssz-text-primary)',
            border: '1px solid var(--ssz-border-strong)',
          }
        : { background: 'var(--ssz-color-error-500)', color: '#fff', border: 'none' };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[52px] w-full items-center justify-center gap-[9px] rounded-(--ssz-radius-md) text-base font-semibold hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 ${RA_FOCUS}`}
      style={look}
    >
      {variant !== 'ghost' && (
        <span
          aria-hidden="true"
          className="block shrink-0 bg-white"
          style={
            variant === 'stop'
              ? { width: 12, height: 12, borderRadius: 3 }
              : { width: 14, height: 14, borderRadius: '50%' }
          }
        />
      )}
      {children}
    </button>
  );
}

/** `wb-msg`: a small line with an icon — muted, or the error tone. */
function Msg({ children, tone, icon }: { children: ReactNode; tone?: 'error'; icon: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className="m-0 flex items-start gap-[5px] text-xs [&>svg]:mt-px [&>svg]:shrink-0"
      style={{
        color: tone === 'error' ? 'var(--ssz-color-error-700)' : 'var(--ssz-text-muted)',
      }}
    >
      {icon}
      <span>{children}</span>
    </p>
  );
}

/** The `ra-rec` box: the recorder, phase by phase (plan 70 §3.3, §7.9). */
function RecorderBlock({
  recorder,
  config,
  mode,
  interactive,
  sourceOf,
  onRetryUpload,
}: {
  recorder: RecorderHandle;
  config: RecorderConfig;
  mode: StudentProjection['mode'];
  interactive: boolean;
  sourceOf: ReadAloudBodyProps['sourceOf'];
  onRetryUpload: ReadAloudBodyProps['onRetryUpload'];
}) {
  const t = useTranslations('ExerciseRunner.readAloud');
  const { state, levels } = recorder;
  const prompt = config.prompts[state.index];
  if (prompt === undefined) return null;
  const { phase } = state;
  const rec = config.recording;

  const frame =
    phase === 'rec' || phase === 'stopping'
      ? {
          borderColor: 'var(--ssz-color-error-500)',
          boxShadow: '0 0 0 3px var(--ssz-color-error-50)',
        }
      : phase === 'prep' || phase === 'count'
        ? { borderColor: 'var(--ssz-color-warning-500)' }
        : { borderColor: 'var(--ssz-border-default)' };

  let body: ReactNode;

  if (phase === 'mic') {
    const ok = micOk(state);
    const silent = micSilent(state);
    body = (
      <>
        <RecHead>
          <Headphones size={13} aria-hidden="true" />
          {t('mic.head')}
        </RecHead>
        <p className="m-0 text-xs text-(--ssz-text-muted)">{t('mic.hint')}</p>
        <Meter levels={levels} tone="calm" />
        {(ok || silent) && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-(--ssz-radius-md) border text-sm"
            style={{
              padding: '10px 12px',
              ...(ok
                ? {
                    background: 'var(--ssz-color-success-50)',
                    borderColor: 'var(--ssz-color-success-500)',
                    color: 'var(--ssz-color-success-700)',
                  }
                : {
                    background: 'var(--ssz-bg-subtle)',
                    borderColor: 'var(--ssz-border-default)',
                    color: 'var(--ssz-text-primary)',
                  }),
            }}
          >
            {ok ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <CircleAlert size={15} aria-hidden="true" />
            )}
            {ok ? t('mic.ok') : t('mic.silent')}
          </div>
        )}
        {/* The check advises; it never locks the student out (Q7-A). */}
        <RecButton variant="ghost" disabled={!interactive} onClick={recorder.ready}>
          {t('mic.ready')}
        </RecButton>
      </>
    );
  } else if (phase === 'denied' || phase === 'noDevice') {
    body = (
      <>
        <RecHead>
          <Headphones size={13} aria-hidden="true" />
          {t('mic.head')}
        </RecHead>
        <Msg tone="error" icon={<CircleAlert size={13} aria-hidden="true" />}>
          {phase === 'denied' ? t('mic.denied') : t('mic.noDevice')}
        </Msg>
        <RecButton variant="ghost" disabled={!interactive} onClick={recorder.retryMic}>
          {t('retry')}
        </RecButton>
      </>
    );
  } else if (phase === 'prep' || phase === 'count') {
    body = (
      <>
        <RecHead>{t('prep.head')}</RecHead>
        {phase === 'prep' ? (
          <Clock seconds={clockSeconds(state, prompt)} warn />
        ) : (
          <span
            aria-live="assertive"
            className="text-2xl font-bold tabular-nums"
            style={{ fontFamily: 'var(--ssz-font-mono)', color: 'var(--ssz-color-warning-700)' }}
          >
            {Math.max(1, COUNTDOWN_SECONDS - state.t)}
          </span>
        )}
        <span className="text-xs text-(--ssz-text-muted)">
          {phase !== 'prep'
            ? t('count.sub')
            : mode === 'read'
              ? t('prep.sub.read')
              : mode === 'monologue'
                ? t('prep.sub.monologue')
                : t('prep.sub.dialogue')}
        </span>
        {phase === 'prep' && (
          <RecButton disabled={!interactive} onClick={recorder.startNow}>
            {t('prep.startNow')}
          </RecButton>
        )}
      </>
    );
  } else if (phase === 'rec' || phase === 'stopping') {
    body = (
      <>
        <RecHead>
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: 'var(--ssz-color-error-700)' }}
          >
            <i
              aria-hidden="true"
              className="block size-2 rounded-full motion-reduce:animate-none"
              style={{
                background: 'var(--ssz-color-error-500)',
                animation: 'ra-pulse 1.1s var(--ssz-ease-out) infinite',
              }}
            />
            {t('rec.head')}
          </span>
          <RecHeadAside>{t('rec.max', { time: formatSeconds(prompt.maxSeconds) })}</RecHeadAside>
        </RecHead>
        <Clock seconds={clockSeconds(state, prompt)} warn={clockWarns(state, prompt)} />
        <Meter levels={levels} tone="live" />
        <div
          className="h-1 overflow-hidden rounded-full"
          style={{ background: 'var(--ssz-bg-muted)' }}
        >
          <i
            className="block h-full"
            style={{
              width: `${recordedShare(state, prompt) * 100}%`,
              background: 'var(--ssz-color-error-500)',
              transition: 'width 120ms linear',
            }}
          />
        </div>
        <RecButton variant="stop" disabled={phase === 'stopping'} onClick={recorder.stop}>
          {t('rec.stop')}
        </RecButton>
      </>
    );
  } else {
    // idle / review
    const own = takesOf(state, prompt.id);
    const pick = chosenIndex(state, config, prompt.id);
    const remaining = left(state, config, prompt.id);
    const chosen = own[pick];
    const short = chosen !== undefined && isShort(chosen, prompt);
    body = (
      <>
        <RecHead>
          <Headphones size={13} aria-hidden="true" />
          {t('idle.head', { n: own.length, total: rec.takes })}
          <RecHeadAside>
            {t('idle.range', {
              min: formatSeconds(prompt.minSeconds),
              max: formatSeconds(prompt.maxSeconds),
            })}
          </RecHeadAside>
        </RecHead>

        {state.notice === 'interrupted' && (
          <Msg tone="error" icon={<CircleAlert size={13} aria-hidden="true" />}>
            {t('interrupted')}
          </Msg>
        )}

        {own.length > 0 && rec.listenBack ? (
          <div
            role={rec.chooseBest ? 'radiogroup' : undefined}
            aria-label={rec.chooseBest ? t('chooseTake') : undefined}
            className="flex flex-col gap-[7px]"
          >
            {own.map((take, i) => {
              const selected = rec.chooseBest && pick === i;
              // By place, not by `n`: a refused take leaves a gap in the numbers.
              const label = t('take.label', { n: i + 1 });
              return (
                <div key={take.n} className="flex flex-col gap-1">
                  <div
                    className="flex items-center gap-2.5"
                    style={{
                      ...takeRowStyle(selected),
                      cursor: rec.chooseBest && interactive ? 'pointer' : undefined,
                    }}
                    onClick={() => rec.chooseBest && interactive && recorder.choose(i)}
                  >
                    {rec.chooseBest ? (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={t('chooseThis', { label })}
                        disabled={!interactive}
                        onClick={(e) => {
                          e.stopPropagation();
                          recorder.choose(i);
                        }}
                        className={`rounded-full ${RA_FOCUS}`}
                      >
                        <TakeNumber n={i + 1} selected={selected} />
                      </button>
                    ) : (
                      <TakeNumber n={i + 1} />
                    )}
                    <TakePlayer
                      source={sourceOf(take.ref, take.assetId)}
                      seconds={take.seconds}
                      label={label}
                      uploading={take.upload === 'pending'}
                      interactive={interactive}
                    />
                  </div>
                  {take.upload === 'failed' && (
                    <UploadFailed
                      canRetry={take.ref !== null && interactive}
                      onRetry={() => onRetryUpload(prompt.id, take.n)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : own.length > 0 ? (
          <>
            <p className="m-0 text-xs text-(--ssz-text-muted)">{t('noListenBack')}</p>
            {own
              .filter((take) => take.upload === 'failed')
              .map((take) => (
                <UploadFailed
                  key={take.n}
                  canRetry={take.ref !== null && interactive}
                  onRetry={() => onRetryUpload(prompt.id, take.n)}
                />
              ))}
          </>
        ) : null}

        {short && (
          <Msg tone="error" icon={<CircleAlert size={13} aria-hidden="true" />}>
            {t('short', { min: formatSeconds(prompt.minSeconds) })}
          </Msg>
        )}

        {remaining > 0 ? (
          <RecButton disabled={!interactive} onClick={recorder.begin}>
            {own.length > 0 ? t('again', { left: remaining }) : t('start')}
          </RecButton>
        ) : (
          <Msg icon={<Lock size={13} aria-hidden="true" />}>{t('spent', { n: rec.takes })}</Msg>
        )}
        {rec.chooseBest && own.length > 1 && (
          <p className="m-0 text-xs text-(--ssz-text-muted)">{t('chosenNote')}</p>
        )}
      </>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-(--ssz-radius-md) border p-(--ssz-space-4)"
      style={{ background: 'var(--ssz-bg-surface)', ...frame }}
    >
      {body}
    </div>
  );
}

function UploadFailed({ canRetry, onRetry }: { canRetry: boolean; onRetry: () => void }) {
  const t = useTranslations('ExerciseRunner.readAloud');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Msg tone="error" icon={<CircleAlert size={13} aria-hidden="true" />}>
        {t('uploadFailed')}
      </Msg>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`text-xs font-semibold underline underline-offset-2 ${RA_FOCUS}`}
          style={{ color: 'var(--ssz-color-error-700)' }}
        >
          {t('retry')}
        </button>
      )}
    </div>
  );
}

/** `wb-run-actions`: the hand-in, and the line that says why it is off (DECISIONS §7). */
function SubmitActions({
  recorder,
  config,
  labelOf,
  interactive,
  submitting,
  error,
  onSubmit,
  accent,
}: {
  recorder: RecorderHandle;
  config: RecorderConfig;
  labelOf: (id: string) => string;
  interactive: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
  accent: string;
}) {
  const t = useTranslations('ExerciseRunner.readAloud');
  const { state } = recorder;
  const block = submitBlock(state, config);
  const busy = ['prep', 'count', 'rec', 'stopping'].includes(state.phase);

  const note =
    block === 'unrecorded'
      ? t('left', { n: config.prompts.length - recordedCount(state, config) })
      : block === 'short'
        ? t('tooShort', { labels: shortOnes(state, config).map(labelOf).join(', ') })
        : block === 'uploading'
          ? t('uploading')
          : t('readByTeacher');

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={!interactive || block !== null || busy || submitting}
        onClick={onSubmit}
        className={`w-full rounded-(--ssz-radius-sm) p-3 text-sm font-semibold text-white disabled:opacity-50 ${RA_FOCUS}`}
        style={{ background: accent }}
      >
        {submitting ? t('sending') : t('submit')}
      </button>
      <p className="m-0 text-center text-xs text-(--ssz-text-muted)">{note}</p>
      {error !== null && (
        <p
          role="alert"
          className="m-0 text-center text-xs"
          style={{ color: 'var(--ssz-color-error-700)' }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
