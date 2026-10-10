'use client';

import { ArrowRight, Check, Eye, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useContainerWidth } from '@/hooks';
import { packFor, type StudentProjection } from '@/lib/shared-kernel/minimal-pairs';

import type { Clips } from './minimal-pairs-clips';
import { PROBE_CLIP, type Sitting } from './minimal-pairs-sitting';
import { MinimalPairsSummary } from './minimal-pairs-summary';

export type MinimalPairsLayout = 'phone' | 'desktop';

/** Below this width the A/B comparison stacks — `mp.css`, `@media (max-width: 560px)`. */
const DESKTOP_AT = 560;
const READING = 'var(--ssz-font-reading)';
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

export interface MinimalPairsBodyProps {
  /** The set as the server projected it — no pair, no word, no clip. */
  projection: StudentProjection;
  sitting: Sitting;
  clips: Clips;
  /** The instruction in the learner's language, where the reader has one; the author's otherwise. */
  instruction?: string;
  /** Forces a layout — the builder preview's phone/desktop switch, and tests (jsdom measures 0). */
  layout?: MinimalPairsLayout;
  /** False in a static preview: everything renders, nothing plays or accepts input. */
  interactive?: boolean;
  /** «Ny runde» — a new attempt with a new draw. Absent where one cannot be had. */
  onRestart?: () => void;
  /** The sittings the author allows, once a new round was refused for them (Q4-A). */
  sittingsSpent?: number | null;
  restarting?: boolean;
  accent: string;
}

/**
 * `minimal_pairs`, as the student hears it — the prototype's `MPRunner` (plan 72 §7.9).
 *
 * One probe at a time: a big button that plays one word, and the two or three words it could
 * have been. Nothing on this screen knows which. The probe comes from the engine with its clip
 * and its buttons — spelled only when the author shows spelling «always» — and the verdict comes
 * back with the key only once the probe closes; the screen draws what it was given and computes
 * nothing (§3.6).
 *
 * One body for the reader, the builder's preview and the static preview — `layout` by prop or
 * by width (plan 72 §5, row 14).
 */
export function MinimalPairsBody({
  projection,
  sitting,
  clips,
  instruction,
  layout,
  interactive = true,
  onRestart,
  sittingsSpent = null,
  restarting = false,
  accent,
}: MinimalPairsBodyProps) {
  const t = useTranslations('ExerciseRunner.minimalPairs');
  const [root, width] = useContainerWidth();
  const wide = (layout ?? (width >= DESKTOP_AT ? 'desktop' : 'phone')) === 'desktop';

  const { state } = sitting;

  if (state.phase === 'done' && state.summary !== null) {
    return (
      <div
        ref={root}
        className="w-full"
        style={wide ? { maxWidth: 640, marginInline: 'auto' } : undefined}
      >
        <MinimalPairsSummary
          summary={state.summary}
          contrastLabel={projection.contrast.label}
          clips={clips}
          interactive={interactive}
          {...(onRestart === undefined ? {} : { onRestart })}
          sittingsSpent={sittingsSpent}
          restarting={restarting}
          accent={accent}
        />
      </div>
    );
  }

  if (projection.set.probes === 0) {
    return (
      <div
        ref={root}
        className="rounded-(--ssz-radius-md) border border-dashed border-(--ssz-border-strong) px-6 py-12 text-center"
      >
        <p className="m-0 text-base font-semibold text-(--ssz-text-primary)">{t('empty.title')}</p>
        <p className="m-0 mt-1 text-sm text-(--ssz-text-secondary)">{t('empty.body')}</p>
      </div>
    );
  }

  const probe = state.probe;
  const verdict = state.verdict;
  const total = probe?.total ?? projection.set.probes;
  const n = probe?.n ?? Object.keys(state.pips).length + 1;
  const answered = verdict !== null;
  const ok = verdict?.correct === true;
  const f = projection.feedback;
  const budget = projection.set.playsPerProbe;
  const left = sitting.left;
  const probePlaying = clips.playing(PROBE_CLIP);

  const shown =
    instruction === undefined || instruction.trim() === ''
      ? projection.instruction.trim() === ''
        ? t('defaultInstruction')
        : projection.instruction
      : instruction;
  const heading = projection.title.trim() === '' ? t('defaultTitle') : projection.title;

  const revealed = (id: string) => verdict?.options?.find((o) => o.id === id);
  const options = probe?.options ?? [];
  const keyId = verdict?.keyOptionId;
  const chosen = verdict === null ? undefined : revealed(verdict.optionId);
  const target = keyId === undefined ? undefined : revealed(keyId);
  const dialect =
    probe === null || probe.clip.dialect === ''
      ? null
      : (packFor(projection.language)?.dialects.find((d) => d.id === probe.clip.dialect)?.student ??
        null);

  const progress = Math.min(1, (n - 1 + (answered ? 1 : 0)) / Math.max(1, total));
  const canPlay = interactive && probe !== null && (left === null || left > 0 || probePlaying);
  const failure = state.failure;
  const last = probe !== null && probe.n >= probe.total;

  return (
    <div
      ref={root}
      data-testid="mp-run"
      className="flex w-full flex-col gap-3.5"
      style={wide ? { maxWidth: 640, marginInline: 'auto' } : undefined}
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
          aria-valuemax={total}
          aria-valuenow={n - 1 + (answered ? 1 : 0)}
        >
          <i
            className="block h-full"
            style={{
              width: `${progress * 100}%`,
              background: 'var(--ssz-color-primary-500)',
              transition: 'width var(--ssz-duration-slow) var(--ssz-ease-out)',
            }}
          />
        </div>
        <span className="text-xs tabular-nums text-(--ssz-text-muted)">
          {n}/{total}
        </span>
      </div>

      {/* mp-pips — by the first answer of each probe (MP-R1) */}
      <div className="flex justify-center gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, k) => {
          const at = k + 1;
          const first = state.pips[at];
          const s = first === true ? 'ok' : first === false ? 'bad' : at === n ? 'now' : undefined;
          return (
            <i
              key={at}
              data-s={s}
              className="block h-1 w-4 rounded-[2px]"
              style={{
                background:
                  s === 'ok'
                    ? 'var(--ssz-color-success-500)'
                    : s === 'bad'
                      ? 'var(--ssz-color-error-500)'
                      : s === 'now'
                        ? 'var(--ssz-interactive-primary)'
                        : 'var(--ssz-bg-muted)',
              }}
            />
          );
        })}
      </div>

      <p className="m-0 text-sm text-(--ssz-text-secondary)">{shown}</p>

      {/* mp-stage */}
      <div
        data-on={clips.anyPlaying ? 'true' : undefined}
        className="flex flex-col items-center gap-3 rounded-(--ssz-radius-lg) border px-4 py-[26px]"
        style={{
          background: clips.anyPlaying ? 'var(--ssz-color-primary-50)' : 'var(--ssz-bg-subtle)',
          borderColor: clips.anyPlaying
            ? 'var(--ssz-color-primary-200)'
            : 'var(--ssz-border-default)',
          transition: 'background 200ms',
        }}
      >
        <PlayButton
          size="lg"
          on={probePlaying}
          disabled={!canPlay}
          onClick={sitting.playProbe}
          label={probePlaying ? t('pause') : t('play')}
        />
        <div className="flex flex-col items-center gap-[3px]">
          {budget > 0 ? (
            <span
              className="inline-flex items-center gap-2 text-xs text-(--ssz-text-secondary)"
              data-testid="mp-left"
            >
              <span className="flex gap-[3px]" aria-hidden="true">
                {Array.from({ length: budget }, (_, k) => (
                  <i
                    key={k}
                    data-spent={k < state.plays ? 'true' : undefined}
                    className="block size-[7px] rounded-full"
                    style={{
                      background:
                        k < state.plays ? 'var(--ssz-bg-muted)' : 'var(--ssz-color-primary-500)',
                    }}
                  />
                ))}
              </span>
              {left !== null && left > 0
                ? t('playsLeft', { left, total: budget })
                : t('noPlaysLeft')}
            </span>
          ) : (
            <span className="text-xs text-(--ssz-text-secondary)" data-testid="mp-left">
              {t('freePlay')}
            </span>
          )}
          {probe?.clip.provenance === 'tts' && (
            <span className="text-xs text-(--ssz-text-muted)">{t('synthetic')}</span>
          )}
          {dialect !== null && <span className="text-xs text-(--ssz-text-muted)">{dialect}</span>}
        </div>
      </div>

      {state.retried && !answered && (
        <p
          role="status"
          className="m-0 flex items-start gap-[5px] text-xs"
          style={{ color: 'var(--ssz-color-error-700)' }}
        >
          <RotateCcw size={13} aria-hidden="true" className="mt-px shrink-0" />
          {t('retry')}
        </p>
      )}

      {/* mp-opts */}
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: options.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr' }}
      >
        {options.map((o, k) => {
          const shownOption = revealed(o.id);
          const st = !answered
            ? undefined
            : o.id === keyId
              ? 'right'
              : o.id === verdict.optionId
                ? 'wrong'
                : 'dim';
          const main = shownOption?.text ?? o.text ?? String.fromCharCode(65 + k);
          const ipa = shownOption?.ipa ?? o.ipa;
          const gloss = shownOption?.gloss ?? o.gloss;
          return (
            <button
              key={o.id}
              type="button"
              data-s={st}
              disabled={!interactive || answered || state.sending || probe === null}
              onClick={() => sitting.pick(o.id)}
              className={`relative flex min-h-[74px] flex-col items-center justify-center gap-[3px] rounded-(--ssz-radius-md) border-[1.5px] border-(--ssz-border-strong) bg-(--ssz-bg-surface) px-3 py-3.5 transition-[border-color,background,transform] duration-[120ms] enabled:hover:border-(--ssz-interactive-primary) enabled:hover:bg-(--ssz-color-primary-50) enabled:active:scale-[0.985] disabled:cursor-default ${FOCUS}`}
              // The verdict's colours only: the resting look is the classes, so hover still works.
              style={
                st === 'right'
                  ? {
                      borderColor: 'var(--ssz-color-success-500)',
                      background: 'var(--ssz-color-success-50)',
                    }
                  : st === 'wrong'
                    ? {
                        borderColor: 'var(--ssz-color-error-500)',
                        background: 'var(--ssz-color-error-50)',
                      }
                    : st === 'dim'
                      ? { opacity: 0.5 }
                      : undefined
              }
            >
              <span
                className="text-xl font-medium text-(--ssz-text-primary)"
                style={{ fontFamily: READING }}
              >
                {main}
              </span>
              {ipa !== undefined && (
                <span
                  className="text-[11px] text-(--ssz-text-muted)"
                  style={{ fontFamily: 'var(--ssz-font-mono)' }}
                >
                  {ipa}
                </span>
              )}
              {gloss !== undefined && (
                <span className="text-center text-xs text-(--ssz-text-secondary)">{gloss}</span>
              )}
              {(st === 'right' || st === 'wrong') && (
                <span
                  data-mark={st}
                  className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full text-white"
                  style={{
                    background:
                      st === 'right'
                        ? 'var(--ssz-color-success-500)'
                        : 'var(--ssz-color-error-500)',
                  }}
                >
                  {st === 'right' ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <X size={14} aria-hidden="true" />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* mp-fb — only when the verdict is shown at once (MP-R11) */}
      {answered && f.immediate && (
        <div
          role="status"
          data-v={ok ? 'ok' : 'bad'}
          className="flex flex-col gap-2.5 rounded-(--ssz-radius-md) border px-3.5 py-3"
          style={{
            borderColor: ok ? 'var(--ssz-color-success-300)' : 'var(--ssz-color-warning-300)',
            background: ok ? 'var(--ssz-color-success-50)' : 'var(--ssz-color-warning-50)',
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-sm text-(--ssz-text-primary)">
              {ok ? t('right') : t('wrong', { word: target?.text ?? '' })}
            </b>
            <span className="flex-1" />
            {!ok &&
              verdict.compare !== undefined &&
              chosen !== undefined &&
              target !== undefined && (
                <button
                  type="button"
                  onClick={sitting.replayCompare}
                  disabled={!interactive}
                  className={`inline-flex items-center gap-1.5 rounded-(--ssz-radius-sm) border px-2.5 py-1.5 text-xs font-medium text-(--ssz-text-primary) disabled:opacity-50 ${FOCUS}`}
                  style={{
                    background: 'var(--ssz-bg-surface)',
                    borderColor: 'var(--ssz-border-strong)',
                  }}
                >
                  <Play size={12} aria-hidden="true" />
                  {t('compare', { chosen: chosen.text, target: target.text })}
                </button>
              )}
          </div>
          {!ok && verdict.compare !== undefined && chosen !== undefined && target !== undefined && (
            <div className="grid gap-2" style={{ gridTemplateColumns: wide ? '1fr 1fr' : '1fr' }}>
              {[
                { o: chosen, url: verdict.compare.chosen, role: 'chosen' as const },
                { o: target, url: verdict.compare.target, role: 'target' as const },
              ].map(({ o, url, role }) => {
                const on = clips.playing(o.id);
                return (
                  <div
                    key={role}
                    data-role={role}
                    data-on={on ? 'true' : undefined}
                    className="flex flex-col items-center gap-1 rounded-(--ssz-radius-sm) border p-2.5"
                    style={{
                      background: 'var(--ssz-bg-surface)',
                      borderColor: on
                        ? 'var(--ssz-interactive-primary)'
                        : 'var(--ssz-border-default)',
                      boxShadow: on ? 'inset 0 0 0 1px var(--ssz-interactive-primary)' : undefined,
                    }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-wide"
                      style={{
                        color:
                          role === 'target'
                            ? 'var(--ssz-color-success-700)'
                            : 'var(--ssz-text-muted)',
                      }}
                    >
                      {role === 'target' ? t('heard') : t('chosen')}
                    </span>
                    <b className="text-lg" style={{ fontFamily: READING }}>
                      {o.text}
                    </b>
                    {o.ipa !== undefined && (
                      <span
                        className="text-[11px] text-(--ssz-text-muted)"
                        style={{ fontFamily: 'var(--ssz-font-mono)' }}
                      >
                        {o.ipa}
                      </span>
                    )}
                    <PlayButton
                      size="sm"
                      on={on}
                      disabled={!interactive}
                      onClick={() => sitting.playWord(o.id, url)}
                      label={on ? t('pause') : t('playWord', { word: o.text })}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {f.showGloss !== 'never' && target?.gloss !== undefined && (
            <p className="m-0 text-xs text-(--ssz-text-muted)">
              {target.text} — {target.gloss}
            </p>
          )}
        </div>
      )}

      {failure !== null && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 text-xs"
          style={{ color: 'var(--ssz-color-error-700)' }}
        >
          <span>
            {failure === 'media'
              ? t('failure.media')
              : failure === 'probe'
                ? t('failure.probe')
                : failure === 'answer'
                  ? t('failure.answer')
                  : t('failure.finish')}
          </span>
          {failure !== 'answer' && (
            <button
              type="button"
              onClick={failure === 'finish' ? sitting.retryFinish : sitting.begin}
              className={`rounded-(--ssz-radius-sm) border px-2.5 py-1 text-xs font-medium text-(--ssz-text-primary) ${FOCUS}`}
              style={{
                borderColor: 'var(--ssz-border-strong)',
                background: 'var(--ssz-bg-surface)',
              }}
            >
              {t('failure.tryAgain')}
            </button>
          )}
        </div>
      )}

      {/* wb-run-actions */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={sitting.next}
          disabled={!interactive || !answered || state.phase === 'finishing'}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-(--ssz-radius-sm) px-4 py-3 text-sm font-semibold text-white disabled:opacity-45 ${FOCUS}`}
          style={{ background: accent, minHeight: 44 }}
        >
          {last ? t('seeResult') : t('next')}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
        {!interactive && (
          <p className="m-0 flex items-center justify-center gap-1.5 p-1.5 text-xs text-(--ssz-text-muted)">
            <Eye size={13} aria-hidden="true" />
            {t('staticPreview')}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The round play button — `MPPlay`. A pause while its clip sounds, with the ring round it; 84 px
 * on the stage, 28 px in the A/B cells.
 */
export function PlayButton({
  on,
  onClick,
  size,
  disabled = false,
  label,
}: {
  on: boolean;
  onClick: () => void;
  size: 'sm' | 'lg';
  disabled?: boolean;
  label: string;
}) {
  const px = size === 'lg' ? 84 : 28;
  const icon = size === 'lg' ? 26 : 12;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={on}
      data-on={on ? 'true' : undefined}
      className={`relative grid shrink-0 place-items-center rounded-full border-0 bg-(--ssz-interactive-primary) text-(--ssz-text-inverse) enabled:hover:bg-(--ssz-interactive-primary-hover) disabled:cursor-not-allowed disabled:bg-(--ssz-bg-muted) disabled:text-(--ssz-text-muted) ${FOCUS}`}
      style={{
        width: px,
        height: px,
        boxShadow: size === 'lg' && !disabled ? 'var(--ssz-shadow-sm)' : undefined,
      }}
    >
      {on ? (
        <Pause size={icon} aria-hidden="true" />
      ) : (
        <Play size={icon} fill="currentColor" aria-hidden="true" />
      )}
      {on && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-2 rounded-full"
          style={{
            border: '2px solid var(--ssz-interactive-primary)',
            opacity: 0.45,
            animation: 'mp-ping 1.1s ease-out infinite',
          }}
        />
      )}
    </button>
  );
}
