'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2, Mic, Square, Trash2, Upload, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MinimalPairsPlayButton } from '@/features/student/exercises/runner';
import { formatMs, hasClip, type Word } from '@/lib/shared-kernel/minimal-pairs';

import type { ClipAsset } from './clip-sources';
import { DELETE, DurationBar, MONO, ProvenanceBadge, READING, Side } from './parts';
import type { WordActivity, WordFailure } from './use-word-sources';

export interface ClipRowProps {
  word: Word;
  index: number;
  asset: ClipAsset | undefined;
  /** The longest clip of the step — the bars are drawn against it. */
  maxMs: number;
  /** The pair's lengths are too far apart: every bar of the pair turns amber. */
  spreadWarn: boolean;
  activity: WordActivity | undefined;
  failure: WordFailure | undefined;
  /** Another word is being recorded: one microphone, one take at a time. */
  micBusy: boolean;
  levels: number[];
  /** The pair's family forbids synthesis (`tts: no`) — the button is off, not warned. */
  ttsBlocked: boolean;
  playing: boolean;
  onPlay: () => void;
  onRecord: () => void;
  onStop: () => void;
  onUpload: () => void;
  onSynthesize: () => void;
  onRemove: () => void;
}

/**
 * `mp-cliprow`: one word's recording (plan 72 §7.3, MP-B10…B13).
 *
 * With a clip: play, the length as a bar and in seconds, who said it, the voice, remove. Without:
 * «no audio» and the three ways to get one. Two states the handoff does not draw — a take being
 * recorded and an asset not measured yet — take the bar's place: a live meter, a spinner.
 */
export function ClipRow({
  word,
  index,
  asset,
  maxMs,
  spreadWarn,
  activity,
  failure,
  micBusy,
  levels,
  ttsBlocked,
  playing,
  onPlay,
  onRecord,
  onStop,
  onUpload,
  onSynthesize,
  onRemove,
}: ClipRowProps) {
  const t = useTranslations('Authoring.minimalPairs.step2');
  const has = hasClip(word.clip);
  const failed = has && asset?.status === 'failed';
  const measuring = has && !failed && (asset?.status !== 'ready' || word.clip.durationMs <= 0);
  const busy = activity !== undefined && activity !== 'recording';

  return (
    <div className="flex flex-col gap-1">
      <div
        data-empty={has ? undefined : 'true'}
        className={`flex flex-wrap items-center gap-2.5 rounded-(--ssz-radius-sm) border px-2.5 py-2 ${
          has
            ? 'border-(--ssz-border-default) bg-(--ssz-bg-surface)'
            : 'border-dashed border-(--ssz-border-default) bg-transparent'
        }`}
      >
        <Side index={index} />
        <MinimalPairsPlayButton
          size="sm"
          on={playing}
          disabled={!has || asset?.url === undefined || asset.url === ''}
          label={t('play', { word: word.text })}
          onClick={onPlay}
        />
        <b className="min-w-24 text-base font-normal" style={READING}>
          {word.text}
        </b>

        {activity === 'recording' ? (
          <>
            <Meter levels={levels} label={t('recordingOf', { word: word.text })} />
            <span className="flex-1" />
            <Button type="button" size="sm" variant="danger" onClick={onStop}>
              <Square className="size-3.5" fill="currentColor" aria-hidden />
              {t('stop')}
            </Button>
          </>
        ) : busy ? (
          <Pending
            text={
              activity === 'synthesizing'
                ? t('synthesizing')
                : activity === 'opening'
                  ? t('recordingOf', { word: word.text })
                  : t('uploading')
            }
          />
        ) : has ? (
          <>
            {measuring ? (
              <Pending text={t('processing')} />
            ) : failed ? (
              <span className="flex flex-1 items-center gap-[5px] text-xs text-(--ssz-color-error-700)">
                <AlertTriangle size={12} aria-hidden="true" />
                {t('processingFailed')}
              </span>
            ) : (
              <>
                <DurationBar ms={word.clip.durationMs} max={maxMs} warn={spreadWarn} />
                <span className="text-[11px] text-(--ssz-text-muted)" style={MONO}>
                  {formatMs(word.clip.durationMs)}
                </span>
              </>
            )}
            <ProvenanceBadge provenance={word.clip.provenance} />
            <span className="text-xs whitespace-nowrap text-(--ssz-text-muted)">
              {word.clip.voice}
            </span>
            <span className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={DELETE}
              aria-label={t('removeClip', { word: word.text })}
              onClick={onRemove}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </>
        ) : (
          <>
            <span className="flex items-center gap-[5px] text-xs text-(--ssz-color-error-700)">
              <AlertTriangle size={12} aria-hidden="true" />
              {t('noAudio')}
            </span>
            <span className="flex-1" />
            <Button type="button" variant="outline" size="sm" disabled={micBusy} onClick={onRecord}>
              <Mic className="size-4" aria-hidden />
              {t('record')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t('uploadOf', { word: word.text })}
              onClick={onUpload}
            >
              <Upload className="size-4" aria-hidden />
              {t('upload')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={ttsBlocked}
              title={ttsBlocked ? t('ttsBlocked') : t('ttsGenerate')}
              onClick={onSynthesize}
            >
              <Wand2 className="size-4" aria-hidden />
              {t('tts')}
            </Button>
          </>
        )}
      </div>
      {failure !== undefined && (
        <p
          role="alert"
          className="m-0 flex items-start gap-[5px] text-xs text-(--ssz-color-error-700)"
        >
          <AlertTriangle size={13} aria-hidden="true" className="mt-px shrink-0" />
          {t(failure)}
        </p>
      )}
    </div>
  );
}

function Pending({ text }: { text: string }) {
  return (
    <span
      role="status"
      className="flex flex-1 items-center gap-1.5 text-xs text-(--ssz-text-muted)"
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      {text}
    </span>
  );
}

/** The `ra-meter` of plan 70, in one row: what the microphone hears now. */
function Meter({ levels, label }: { levels: number[]; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="flex h-5 max-w-[220px] min-w-[60px] flex-1 items-center gap-[2px]"
    >
      {levels.map((level, i) => (
        <i
          key={i}
          className="block flex-1 rounded-[1px] bg-(--ssz-color-primary-400)"
          style={{ height: `${Math.max(12, Math.round(level * 100))}%` }}
        />
      ))}
    </span>
  );
}
