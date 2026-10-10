'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useClipPlayer } from '@/features/student/exercises/runner';
import { allWords, hasClip, setClip as setClipOf } from '@/lib/shared-kernel/minimal-pairs';

import { Callout, Card } from '../highlight-in-text/parts';
import type { ClipSources } from './clip-sources';
import type { DocumentUpdate, MinimalPairsDocument } from './edits';
import {
  detectRegions,
  durationMs,
  encodeWav,
  fitRegions,
  formatClock,
  moveEdge,
  peaksOf,
  type DecodedAudio,
  type Region,
} from './slice';

/** Bars in the waveform — the prototype draws 96. */
const BARS = 96;
/** One arrow press moves an edge this far; with Shift, five times as far. */
const STEP_MS = 10;

type Session =
  | { state: 'empty' }
  | { state: 'decoding'; name: string }
  | { state: 'failed'; name: string }
  | { state: 'ready'; name: string; audio: DecodedAudio; peaks: number[]; regions: Region[] }
  | { state: 'cutting'; name: string; audio: DecodedAudio; peaks: number[]; regions: Region[] };

export interface SlicePanelProps {
  exercise: MinimalPairsDocument;
  exerciseId: string;
  sources: ClipSources;
  onChange: DocumentUpdate;
  onClose: () => void;
}

/**
 * «Slice one file» (plan 72 Q3-A, §7.3, MP-B16, MP-U2).
 *
 * The session's own waveform, a mark per word found by silence, edges the author can drag (or
 * move with the arrow keys), and «Cut into N clips»: each region becomes a WAV, uploaded as the
 * word's clip. The regions go to the words that have no audio yet, in pair order — a word that
 * already has a clip is never overwritten by a slice. The session's file name is the voice of
 * every clip cut from it, so one session reads as one voice to the mixed-voice check (§3.4). The
 * file itself never leaves the browser.
 */
export function SlicePanel({ exercise, exerciseId, sources, onChange, onClose }: SlicePanelProps) {
  const t = useTranslations('Authoring.minimalPairs.slice');
  const [session, setSession] = useState<Session>({ state: 'empty' });
  const [failedUploads, setFailedUploads] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const clips = useClipPlayer();
  const previews = useRef<string[]>([]);

  useEffect(() => {
    const own = previews.current;
    return () => own.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const targets = allWords(exercise).filter((w) => w.text.trim() !== '' && !hasClip(w.clip));

  const open = (file: File) => {
    if (targets.length === 0) return;
    setFailedUploads(0);
    setSession({ state: 'decoding', name: file.name });
    sources
      .decode(file)
      .then((audio) =>
        setSession({
          state: 'ready',
          name: file.name,
          audio,
          peaks: peaksOf(audio, BARS),
          regions: fitRegions(detectRegions(audio), targets.length),
        }),
      )
      .catch(() => setSession({ state: 'failed', name: file.name }));
  };

  const cut = async () => {
    if (session.state !== 'ready') return;
    const { audio, regions, name, peaks } = session;
    setSession({ state: 'cutting', name, audio, peaks, regions });
    // The regions whose upload failed stay, for a second «Cut»: the words they belong to are
    // still the first ones without audio, in the same order.
    const kept: Region[] = [];
    for (let i = 0; i < regions.length; i++) {
      const word = targets[i];
      const region = regions[i];
      if (word === undefined || region === undefined) continue;
      const fileName = `${word.text.trim() || 'clip'}.wav`;
      try {
        const assetId = await sources.upload(
          new File([encodeWav(audio, region)], fileName, { type: 'audio/wav' }),
          exerciseId,
        );
        onChange((current) => ({
          ...current,
          ...setClipOf(current, word.pairId, word.id, {
            assetId,
            fileName,
            durationMs: 0,
            provenance: 'studio',
            voice: name,
          }),
        }));
      } catch {
        kept.push(region);
      }
    }
    if (kept.length === 0) {
      onClose();
      return;
    }
    setFailedUploads(kept.length);
    setSession({ state: 'ready', name, audio, peaks, regions: kept });
  };

  const preview = (audio: DecodedAudio, region: Region, index: number) => {
    const url = URL.createObjectURL(encodeWav(audio, region));
    previews.current.push(url);
    void clips.play({ id: `region-${index}`, url });
  };

  const loaded = session.state === 'ready' || session.state === 'cutting' ? session : null;
  const count = loaded === null ? 0 : Math.min(loaded.regions.length, targets.length);

  return (
    <Card>
      <Callout tone="tip">{t.rich('tip', { b: (chunks) => <b>{chunks}</b> })}</Callout>

      {targets.length === 0 && (
        <p className="m-0 text-xs text-(--ssz-text-muted)">{t('noTargets')}</p>
      )}

      {loaded === null ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            const file = event.dataTransfer.files[0];
            if (file !== undefined) open(file);
          }}
          className={`flex flex-col items-center gap-2.5 rounded-(--ssz-radius-md) border border-dashed px-6 py-8 text-center ${
            dragOver
              ? 'border-(--ssz-interactive-primary) bg-(--ssz-color-primary-50)'
              : 'border-(--ssz-border-strong) bg-(--ssz-bg-subtle)'
          }`}
        >
          {session.state === 'decoding' ? (
            <p
              role="status"
              className="m-0 flex items-center gap-2 text-sm text-(--ssz-text-secondary)"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('decoding')}
            </p>
          ) : (
            <>
              <Upload size={26} aria-hidden="true" className="text-(--ssz-text-muted)" />
              <h3 className="m-0 text-base font-semibold">{t('drop')}</h3>
              <p className="m-0 max-w-[46ch] text-sm text-(--ssz-text-secondary)">
                {t('dropHint')}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={targets.length === 0}
                onClick={() => input.current?.click()}
              >
                {t('choose')}
              </Button>
              {session.state === 'failed' && (
                <p role="alert" className="m-0 text-xs text-(--ssz-color-error-700)">
                  {t('decodeFailed')}
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <Wave
          session={loaded}
          words={targets.map((w) => w.text)}
          disabled={loaded.state === 'cutting'}
          playing={(i) => clips.playing(`region-${i}`)}
          onPreview={(region, i) => preview(loaded.audio, region, i)}
          onMove={(regions) => setSession({ ...loaded, state: 'ready', regions })}
        />
      )}

      {loaded !== null && loaded.regions.length === 0 && (
        <p role="alert" className="m-0 text-xs text-(--ssz-color-error-700)">
          {t('noRegions')}
        </p>
      )}
      {loaded !== null && count > 0 && (
        <p className="m-0 text-xs text-(--ssz-text-muted)">
          {t('targets', {
            words: targets
              .slice(0, count)
              .map((w) => w.text)
              .join(' · '),
          })}
        </p>
      )}
      {failedUploads > 0 && (
        <p role="alert" className="m-0 text-xs text-(--ssz-color-error-700)">
          {t('cutFailed', { count: failedUploads })}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {loaded !== null && (
          <span className="text-xs text-(--ssz-text-muted)">
            {t('summary', {
              file: loaded.name,
              time: formatClock(durationMs(loaded.audio)),
              count: loaded.regions.length,
            })}
          </span>
        )}
        <span className="flex-1" />
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={loaded === null || count === 0 || loaded.state === 'cutting'}
          onClick={() => void cut()}
        >
          {loaded?.state === 'cutting' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {loaded?.state === 'cutting' ? t('cutting') : t('cut', { count })}
        </Button>
      </div>

      <input
        ref={input}
        type="file"
        accept="audio/*"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file !== undefined) open(file);
        }}
      />
    </Card>
  );
}

/**
 * `mp-slice`: the waveform of the session and a mark per region under it. Each mark carries the
 * word it will become and two edges; an edge is a slider — dragged with the pointer, moved with
 * the arrow keys. Pressing the mark plays the region as it will be cut.
 */
function Wave({
  session,
  words,
  disabled,
  playing,
  onPreview,
  onMove,
}: {
  session: { audio: DecodedAudio; peaks: number[]; regions: Region[] };
  words: string[];
  disabled: boolean;
  playing: (index: number) => boolean;
  onPreview: (region: Region, index: number) => void;
  onMove: (regions: Region[]) => void;
}) {
  const t = useTranslations('Authoring.minimalPairs.slice');
  const surface = useRef<HTMLDivElement>(null);
  const total = durationMs(session.audio);
  const pct = (ms: number) => `${total > 0 ? (ms / total) * 100 : 0}%`;

  const msAt = (clientX: number): number => {
    const box = surface.current?.getBoundingClientRect();
    if (box === undefined || box.width === 0) return 0;
    return ((clientX - box.left) / box.width) * total;
  };

  const drag = (index: number, edge: 'start' | 'end') => ({
    onPointerDown: (event: PointerEvent<HTMLSpanElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLSpanElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      onMove(moveEdge(session.regions, index, edge, msAt(event.clientX), total));
    },
    onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => {
      if (disabled) return;
      const r = session.regions[index];
      if (r === undefined) return;
      const step = event.shiftKey ? STEP_MS * 5 : STEP_MS;
      const delta = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      if (delta === 0) return;
      event.preventDefault();
      onMove(
        moveEdge(
          session.regions,
          index,
          edge,
          (edge === 'start' ? r.startMs : r.endMs) + delta,
          total,
        ),
      );
    },
  });

  return (
    <div
      ref={surface}
      className="relative rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-subtle) px-2.5 pt-3.5 pb-[30px]"
    >
      <div aria-hidden="true" className="flex h-[46px] items-center gap-[2px]">
        {session.peaks.map((peak, i) => (
          <i
            key={i}
            className="block flex-1 rounded-[1px] bg-(--ssz-color-primary-300) opacity-75"
            style={{ height: `${Math.max(6, Math.round(peak * 46))}px` }}
          />
        ))}
      </div>
      <div className="absolute inset-x-2.5 bottom-1.5 h-[22px]">
        {session.regions.map((region, i) => {
          const word = words[i];
          const label = t('region', { index: i + 1, word: word ?? '—' });
          return (
            <span
              key={i}
              data-spare={word === undefined ? 'true' : undefined}
              className={`absolute top-0 flex h-[22px] items-stretch overflow-hidden rounded-(--ssz-radius-xs) border bg-(--ssz-bg-surface) text-[10px] ${
                word === undefined
                  ? 'border-dashed border-(--ssz-border-strong) text-(--ssz-text-muted)'
                  : 'border-(--ssz-interactive-primary) text-(--ssz-text-primary)'
              }`}
              style={{ left: pct(region.startMs), width: pct(region.endMs - region.startMs) }}
            >
              <span
                role="slider"
                tabIndex={disabled ? -1 : 0}
                aria-label={t('regionStart', { index: i + 1 })}
                aria-valuemin={0}
                aria-valuemax={Math.round(total)}
                aria-valuenow={region.startMs}
                aria-valuetext={formatClock(region.startMs)}
                className="w-1.5 shrink-0 cursor-ew-resize touch-none bg-(--ssz-color-primary-200) focus-visible:bg-(--ssz-interactive-primary) focus-visible:outline-none"
                {...drag(i, 'start')}
              />
              <button
                type="button"
                aria-label={label}
                aria-pressed={playing(i)}
                disabled={disabled}
                onClick={() => onPreview(region, i)}
                className="min-w-0 flex-1 truncate px-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--ssz-interactive-primary)"
              >
                {word ?? '—'}
              </button>
              <span
                role="slider"
                tabIndex={disabled ? -1 : 0}
                aria-label={t('regionEnd', { index: i + 1 })}
                aria-valuemin={0}
                aria-valuemax={Math.round(total)}
                aria-valuenow={region.endMs}
                aria-valuetext={formatClock(region.endMs)}
                className="w-1.5 shrink-0 cursor-ew-resize touch-none bg-(--ssz-color-primary-200) focus-visible:bg-(--ssz-interactive-primary) focus-visible:outline-none"
                {...drag(i, 'end')}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
