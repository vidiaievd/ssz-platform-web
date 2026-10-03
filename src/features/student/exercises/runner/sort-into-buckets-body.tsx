'use client';

import { useState, type DragEvent, type ReactNode } from 'react';
import { ArrowRight, Check, CircleAlert, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useContainerWidth } from '@/hooks';
import type { StudentProjection } from '@/lib/shared-kernel/sort-into-buckets';
import type {
  SortIntoBucketsItemResult,
  SortIntoBucketsSubmitDetails,
} from '@/features/student/exercises/types/attempts';

import { Instr } from './instr';

/**
 * Where the runner is. `closed` is not a phase of its own, as for `multiple_choice_group`:
 * it is the server's word on the verdict (`verdict.closed`), not a decision made here.
 */
export type SortIntoBucketsPhase = 'answering' | 'checked' | 'done';

/** `itemId → bucketId`. A tile still in the pool is simply absent. */
export type SortIntoBucketsPlacements = Record<string, string>;

/**
 * How a tile is drawn.
 *
 * `placed` is a tile the student has put down and not yet had checked; `ok` is one the
 * server froze; `bad` is one it checked and found in the wrong zone; `key` is a tile drawn
 * in the zone it belongs to, which only a closed board with the key visible ever shows.
 */
type TileState = 'pool' | 'placed' | 'ok' | 'bad' | 'key';

/** Where the pool earns a column of its own: 20rem for it, enough left for two zones. */
const POOL_COLUMN_AT = 720;
/** BEHAVIOR §Accessibility: every tile and zone is comfortably tappable. */
const TAP_MIN = 44;
const READING = 'var(--ssz-font-reading)';
/** The explanation fades in (BEHAVIOR §Motion); `prefers-reduced-motion` is global. */
const FADE = 'fade-in 220ms ease-out';
const TILE_MOTION = 'background-color 120ms, border-color 120ms, opacity 120ms';

const OK = {
  bg: 'var(--ssz-feedback-ok-bg)',
  line: 'var(--ssz-feedback-ok-line)',
  fg: 'var(--ssz-feedback-ok-fg)',
};
const NO = {
  bg: 'var(--ssz-feedback-no-bg)',
  line: 'var(--ssz-feedback-no-line)',
  fg: 'var(--ssz-feedback-no-fg)',
};

export interface SortIntoBucketsBodyProps {
  /** The board as the server dealt it: zones, tiles in their dealt order, and no key. */
  projection: StudentProjection;
  /** Replaces the author's instruction line, which the reader translates per learner. */
  instruction?: string;
  /** Where every tile stands now, locked and unchecked alike. */
  placements: SortIntoBucketsPlacements;
  /** Put a tile in a zone, or take it back to the pool with `null`. */
  onPlace: (itemId: string, bucketId: string | null) => void;
  phase: SortIntoBucketsPhase;
  /** What the last check said. `null` before the first one and again after a retry. */
  verdict: SortIntoBucketsSubmitDetails | null;
  /**
   * Tiles the server froze, cumulative.
   *
   * A prop of its own rather than a field of `verdict`, because it outlives it: a retry
   * drops the marks and the explanations and keeps the freeze (plan 54's lesson).
   */
  locked?: string[];
  /** The check the board is on, 1-based — one past the last when a retry has been made. */
  attempt: number;
  sending?: boolean;
  error?: string | null;
  /** False in a preview: everything renders, nothing accepts input. */
  interactive?: boolean;
  onCheck: () => void;
  onRetry: () => void;
  onReveal: () => void;
  onFinish: () => void;
  onRestart?: () => void;
  accent: string;
}

/**
 * `sort_into_buckets`, as the learner plays it: tiles to put into zones.
 *
 * One component for both layouts, switched on its **own** width (`useContainerWidth`), not
 * the window's — the builder preview is a phone frame on a desktop screen. Wide: the pool
 * and the actions in a column on the left, zones in a grid on the right. Narrow: zones
 * stacked, the pool and the actions stuck to the bottom.
 *
 * Controlled, and it owns nothing about the outcome. Which zone is right, which tiles are
 * frozen and whether the board is closed are the server's; there is no branch here that
 * could mark a tile right before a check, because nothing here knows the key. What comes
 * back with a check is drawn as it came.
 *
 * Three ways to move a tile, and the last two are not optional extras (AC-S1): drag, tap a
 * tile and then a zone, and the keyboard — Enter or Space picks a tile up, Enter on a zone
 * puts it down, Escape lets go.
 *
 * **No count of what is left unless the author asked for one** (AC-S9). That rules out a
 * progress bar as well as the pool header: placed over total is remaining by subtraction.
 */
export function SortIntoBucketsBody({
  projection,
  instruction,
  placements,
  onPlace,
  phase,
  verdict,
  locked = [],
  attempt,
  sending = false,
  error = null,
  interactive = true,
  onCheck,
  onRetry,
  onReveal,
  onFinish,
  onRestart,
  accent,
}: SortIntoBucketsBodyProps) {
  const t = useTranslations('ExerciseRunner.sortIntoBuckets');
  const [root, width] = useContainerWidth();
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { buckets, items, settings } = projection;
  const wide = width >= POOL_COLUMN_AT;

  const lockedSet = new Set(locked);
  const outcomes = new Map<string, SortIntoBucketsItemResult>(
    (verdict?.items ?? []).map((item) => [item.itemId, item]),
  );
  const closed = verdict?.closed === true;
  const canEdit = interactive && phase !== 'done' && !closed && !sending;
  const bucketLabel = new Map(buckets.map((b) => [b.id, b.label]));

  /** Which state a tile is in, and which zone it is drawn in (`null` is the pool). */
  const placeOf = (itemId: string): { state: TileState; zone: string | null } => {
    const outcome = outcomes.get(itemId);
    const here = placements[itemId];

    // A closed board that was allowed to show its key draws a wrong tile where it belongs.
    if (outcome?.correctBucketId !== undefined && !outcome.correct) {
      return { state: 'key', zone: outcome.correctBucketId };
    }
    if (lockedSet.has(itemId)) return { state: 'ok', zone: here ?? null };
    if (here === undefined) return { state: 'pool', zone: null };
    if (outcome !== undefined && !outcome.correct && outcome.chosenBucketId === here) {
      return { state: 'bad', zone: here };
    }
    return { state: 'placed', zone: here };
  };

  const tiles = items.map((item) => ({ item, ...placeOf(item.id) }));
  const pool = tiles.filter((tile) => tile.zone === null);
  const unchecked = tiles.filter((tile) => tile.state === 'placed').length;
  const wrong = tiles.filter((tile) => tile.state === 'bad').length;
  const total = items.length;

  if (total === 0 || buckets.length < 2) {
    return (
      <div
        ref={root}
        className="rounded-2xl px-6 py-10 text-center"
        style={{ border: '1.5px dashed var(--ssz-border-default)' }}
      >
        <p className="text-[14px] font-semibold text-(--ssz-text-primary)">{t('empty.title')}</p>
        <p className="mt-1 text-[12.5px] text-(--ssz-text-muted)">{t('empty.body')}</p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div
        ref={root}
        className="flex flex-col items-center gap-2.5 px-6 py-10 text-center"
        role="status"
        style={{ color: 'var(--ssz-color-success-700)' }}
      >
        <Check size={26} aria-hidden="true" />
        <h4 className="m-0 text-[17px] font-bold text-(--ssz-text-primary)">{t('done.title')}</h4>
        <p className="m-0 text-[13.5px] text-(--ssz-text-secondary)">
          {t('done.score', {
            score: verdict?.passedItems ?? 0,
            total: verdict?.totalItems ?? total,
          })}
        </p>
        {error !== null && (
          <p className="text-[12.5px]" style={{ color: NO.fg }}>
            {error}
          </p>
        )}
        {onRestart && (
          <button
            type="button"
            onClick={onRestart}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ borderColor: 'var(--ssz-border-default)', color: 'var(--ssz-text-secondary)' }}
          >
            <RotateCcw size={13} aria-hidden="true" />
            {t('done.again')}
          </button>
        )}
      </div>
    );
  }

  const movable = (state: TileState) => canEdit && (state === 'pool' || state === 'placed');

  function put(itemId: string, bucketId: string | null) {
    onPlace(itemId, bucketId);
    setSelected(null);
  }

  /** Only a tile that exists and may still move can be dropped; the payload is a string. */
  function dropped(event: DragEvent): string | null {
    const id = event.dataTransfer.getData('text/plain');
    const tile = tiles.find((candidate) => candidate.item.id === id);
    return tile !== undefined && movable(tile.state) ? id : null;
  }

  const renderTile = (tile: (typeof tiles)[number]): ReactNode => {
    const { item, state, zone } = tile;
    const isSelected = selected === item.id;
    const zoneName = zone === null ? '' : (bucketLabel.get(zone) ?? '');
    const tone = state === 'ok' ? OK : state === 'bad' ? NO : state === 'key' ? OK : null;
    const free = movable(state);

    const label =
      state === 'ok'
        ? t('tileLocked', { text: item.text, bucket: zoneName })
        : state === 'bad'
          ? t('tileWrong', { text: item.text, bucket: zoneName })
          : state === 'key'
            ? t('tileKey', { text: item.text, bucket: zoneName })
            : state === 'placed'
              ? t('tilePlaced', { text: item.text, bucket: zoneName })
              : item.text;

    return (
      <button
        key={item.id}
        type="button"
        draggable={free}
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', item.id);
          event.dataTransfer.effectAllowed = 'move';
        }}
        onClick={(event) => {
          if (!free) return;
          if (state === 'pool') {
            // A tile already picked up and another tapped: the second one is picked up.
            event.stopPropagation();
            setSelected(isSelected ? null : item.id);
            return;
          }
          // A placed tile with nothing picked up goes back to the pool (AC-S2). With a tile
          // in hand the tap falls through to its zone, which is where that tile is going.
          if (selected === null) {
            event.stopPropagation();
            put(item.id, null);
          }
        }}
        aria-label={label}
        aria-disabled={!free}
        {...(state === 'pool' ? { 'aria-pressed': isSelected } : {})}
        tabIndex={free || state === 'pool' ? 0 : -1}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-[15px] leading-[1.35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
        style={{
          minHeight: TAP_MIN,
          fontFamily: READING,
          transition: TILE_MOTION,
          cursor: free ? (state === 'pool' ? 'grab' : 'pointer') : 'default',
          background: tone?.bg ?? (isSelected ? 'var(--ssz-bg-subtle)' : 'var(--ssz-bg-surface)'),
          borderColor: tone?.line ?? (isSelected ? accent : 'var(--ssz-border-default)'),
          borderStyle: state === 'key' ? 'dashed' : 'solid',
          borderWidth: isSelected ? 2 : 1,
          color: tone?.fg ?? 'var(--ssz-text-primary)',
        }}
      >
        {/* Right and wrong ride in an icon as well as a colour (BEHAVIOR §Accessibility). */}
        {(state === 'ok' || state === 'key') && <Check size={14} aria-hidden="true" />}
        {state === 'bad' && <X size={14} aria-hidden="true" />}
        <span>{item.text}</span>
      </button>
    );
  };

  const renderZone = (bucket: StudentProjection['buckets'][number]) => {
    const inside = tiles.filter((tile) => tile.zone === bucket.id);
    const over = dragOver === bucket.id;
    const armed = selected !== null && canEdit;
    const rule = verdict?.rules.find((r) => r.bucketId === bucket.id)?.rule;
    const hint = rule === undefined ? bucket.hint : undefined;
    const notes = inside.flatMap(({ item, state }) => {
      const outcome = outcomes.get(item.id);
      if (outcome === undefined) return [];
      if (state === 'bad' && outcome.explanation !== undefined) {
        return [{ id: item.id, text: item.text, body: outcome.explanation }];
      }
      if (outcome.why !== undefined) return [{ id: item.id, text: item.text, body: outcome.why }];
      return [];
    });

    return (
      <div
        key={bucket.id}
        role="group"
        aria-label={t('zoneLabel', { label: bucket.label, n: inside.length })}
        tabIndex={canEdit ? 0 : -1}
        onClick={() => {
          if (armed && selected !== null) put(selected, bucket.id);
        }}
        onKeyDown={(event) => {
          // The tiles inside are buttons with their own Enter; only the zone's own counts.
          if (event.target !== event.currentTarget) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          if (armed && selected !== null) put(selected, bucket.id);
        }}
        onDragOver={(event) => {
          if (!canEdit) return;
          event.preventDefault();
          setDragOver(bucket.id);
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={(event) => {
          setDragOver(null);
          const id = dropped(event);
          if (id === null) return;
          event.preventDefault();
          put(id, bucket.id);
        }}
        className="flex flex-col gap-2 rounded-xl border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
        style={{
          minHeight: TAP_MIN * 2,
          transition: TILE_MOTION,
          background: over ? 'var(--ssz-bg-subtle)' : 'var(--ssz-bg-surface)',
          borderColor: over || armed ? accent : 'var(--ssz-border-default)',
          borderStyle: inside.length === 0 ? 'dashed' : 'solid',
          cursor: armed ? 'pointer' : 'default',
        }}
      >
        <div>
          <div className="text-[15px] font-bold" style={{ fontFamily: READING }}>
            {bucket.label}
          </div>
          {hint !== undefined && (
            <p className="m-0 mt-0.5 text-[12.5px] text-(--ssz-text-muted)">{hint}</p>
          )}
          {rule !== undefined && (
            <p
              className="m-0 mt-0.5 text-[12.5px] text-(--ssz-text-secondary)"
              style={{ animation: FADE }}
            >
              <b className="font-semibold">{t('rule')}: </b>
              {rule}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">{inside.map(renderTile)}</div>
        {inside.length === 0 && (
          <p className="m-0 text-[12.5px] italic text-(--ssz-text-muted)">
            {armed ? t('zoneTap') : t('zoneIdle')}
          </p>
        )}

        {notes.map((note) => (
          <p
            key={note.id}
            className="m-0 text-[13px] leading-[1.5]"
            style={{ animation: FADE, color: 'var(--ssz-text-secondary)' }}
          >
            <b className="font-semibold" style={{ fontFamily: READING }}>
              {note.text}
            </b>{' '}
            — {note.body}
          </p>
        ))}
      </div>
    );
  };

  const attemptLine =
    settings.attempts === 0
      ? t('attempt', { n: attempt })
      : t('attemptOf', { n: attempt, max: settings.attempts });
  const correctNow = verdict?.correctNow ?? (attempt > 1 ? lockedSet.size : null);
  const showFooter = verdict !== null || attempt > 1;

  const poolBlock = (
    <div
      className={
        wide
          ? 'flex flex-col gap-3'
          : 'sticky bottom-0 z-10 -mx-1 flex flex-col gap-3 border-t px-1 pb-2 pt-3'
      }
      style={
        wide
          ? undefined
          : { background: 'var(--ssz-bg-page)', borderColor: 'var(--ssz-border-default)' }
      }
    >
      {pool.length > 0 && (
        <div
          onDragOver={(event) => {
            if (canEdit) event.preventDefault();
          }}
          onDrop={(event) => {
            const id = dropped(event);
            if (id === null) return;
            event.preventDefault();
            put(id, null);
          }}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h5 className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-(--ssz-text-muted)">
              {t('poolTitle')}
            </h5>
            {settings.showRemaining && (
              <span className="text-[12.5px] font-semibold text-(--ssz-text-muted)">
                {t('remaining', { n: pool.length })}
              </span>
            )}
          </div>
          <div
            className={
              wide ? 'flex flex-wrap gap-2' : 'flex max-h-[34vh] flex-wrap gap-2 overflow-y-auto'
            }
          >
            {pool.map(renderTile)}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {closed ? (
          <button
            type="button"
            onClick={onFinish}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ background: accent, minHeight: TAP_MIN }}
          >
            {t('finish')}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        ) : (
          <>
            {verdict !== null && wrong > 0 && (
              <button
                type="button"
                disabled={!interactive || sending}
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
                style={{ background: accent, minHeight: TAP_MIN }}
              >
                <RotateCcw size={14} aria-hidden="true" />
                {t('retryWrong', { n: wrong })}
              </button>
            )}
            {/* Primary until a check has left something to retry; after that a partial
                answer is still never a dead end, but the retry leads. */}
            <button
              type="button"
              disabled={!interactive || sending || unchecked === 0}
              onClick={onCheck}
              className={
                verdict !== null && wrong > 0
                  ? 'rounded-xl border px-4 py-2 text-[13px] font-semibold disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)'
                  : 'rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)'
              }
              style={
                verdict !== null && wrong > 0
                  ? {
                      minHeight: TAP_MIN,
                      borderColor: 'var(--ssz-border-default)',
                      color: 'var(--ssz-text-secondary)',
                    }
                  : { minHeight: TAP_MIN, background: accent }
              }
            >
              {sending
                ? t('checking')
                : unchecked > 0
                  ? t('checkCount', { n: unchecked })
                  : t('check')}
            </button>
            {settings.revealKey && (verdict !== null || attempt > 1) && (
              <button
                type="button"
                disabled={!interactive || sending}
                onClick={onReveal}
                className="rounded-xl border px-4 py-2 text-[13px] font-semibold disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
                style={{
                  minHeight: TAP_MIN,
                  borderColor: 'var(--ssz-border-default)',
                  color: 'var(--ssz-text-secondary)',
                }}
              >
                {t('showKey')}
              </button>
            )}
          </>
        )}
      </div>

      {showFooter && (
        <p className="m-0 text-[12.5px] text-(--ssz-text-muted)">
          {attemptLine}
          {correctNow !== null && ` · ${t('score', { correct: correctNow, total })}`}
        </p>
      )}

      {error !== null && (
        <p className="m-0 flex items-start gap-1.5 text-[12.5px]" style={{ color: NO.fg }}>
          <CircleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );

  const selectedText = items.find((item) => item.id === selected)?.text;

  return (
    <div
      ref={root}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setSelected(null);
      }}
    >
      {instruction !== undefined && instruction !== '' && <Instr>{instruction}</Instr>}

      {/* The verdict, and what is in hand, spoken. The per-tile explanations are ordinary
          text under their zone and need no announcing of their own. */}
      <p role="status" className="sr-only">
        {verdict !== null
          ? t('score', { correct: verdict.correctNow, total: verdict.totalItems })
          : selectedText !== undefined
            ? t('selected', { text: selectedText })
            : ''}
      </p>

      <div
        className={wide ? 'grid items-start gap-6' : 'flex flex-col gap-3'}
        style={wide ? { gridTemplateColumns: 'minmax(0, 20rem) minmax(0, 1fr)' } : undefined}
      >
        {wide && poolBlock}
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: wide ? 'repeat(auto-fill, minmax(14rem, 1fr))' : 'minmax(0, 1fr)',
          }}
        >
          {buckets.map(renderZone)}
        </div>
        {!wide && poolBlock}
      </div>
    </div>
  );
}
