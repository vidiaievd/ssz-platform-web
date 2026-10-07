'use client';

import { useTranslations } from 'next-intl';
import { FileQuestion } from 'lucide-react';

import type {
  ReadAloudDetails,
  ReadAloudPromptDetail,
} from '@/features/content-authoring/types/review';
import {
  markKey,
  marksOf,
  passagePieces,
  readSubmission,
  wordKey,
  type SpeakingCriterion,
  type SpeakingSnapshot,
} from '@/lib/shared-kernel/read-aloud';
import { scoreRubric, type RubricMarks } from '@/lib/shared-kernel/writing-task';

import type { ReviewPlayback, ReviewSubmission } from '../../types';
import { Note } from '../primitives';

import { ReviewTakePlayer } from './review-take-player';

const LEVELS = [0, 1, 2, 3] as const;
const READING = 'var(--ssz-font-reading)';
const MONO = 'var(--ssz-font-mono)';
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

export interface ReadAloudReviewProps {
  submission: ReviewSubmission;
  /** The engine's breakdown, read whole; null draws each recording with what it carries itself. */
  details: ReadAloudDetails | null;
  /** The rubric frozen on the submission. */
  snapshot: SpeakingSnapshot;
  /** Marks keyed `itemId:criterionId` — the draft while open, the delivered ones after. */
  marks: Record<string, number>;
  onMark: (key: string, mark: number) => void;
  /** Each prompt's comment, by item id. */
  comments: Record<string, string>;
  onComment: (itemId: string, value: string | undefined) => void;
  editable: boolean;
}

/** One prompt as the screen draws it — from the breakdown when there is one. */
interface PromptView {
  itemId: string;
  label: string;
  detail: ReadAloudPromptDetail | null;
  assetId: string;
  seconds: number;
  takes: number;
}

/**
 * A `read_aloud` submission in the shared inbox — one block per prompt (plan 70 §7.11, RA-Q1):
 * the recording with its player, the passage with the focus words lit, the listening note, the
 * rubric and the comment that has to be written before anything is sent.
 *
 * A prompt is an element (README idea 1): its marks, its comment and its verdict are its own, and
 * the decision below them is the only thing shared. The order is the one the student handed in,
 * which is the order the engine checks the marks in.
 *
 * Built from the submitted answer first and the breakdown second. The recordings are the
 * student's work and outlive the exercise; the breakdown is recomputed against today's exercise
 * and is null once the author has deleted it — the blocks are then drawn with their recordings
 * and their rubric, and the material is said to be gone.
 */
export function ReadAloudReview({
  submission,
  details,
  snapshot,
  marks,
  onMark,
  comments,
  onComment,
  editable,
}: ReadAloudReviewProps) {
  const t = useTranslations('Review.readAloud');
  const prompts = promptsOf(submission, details);
  const decided = new Map((submission.reviewDecisions ?? []).map((d) => [d.itemId, d]));

  return (
    <section className="flex flex-col gap-3">
      {submission.playback === null && (
        <Note tone="warn" icon={FileQuestion} title={t('noPlayback.title')}>
          {t('noPlayback.body')}
        </Note>
      )}
      {prompts.map((prompt, index) => (
        <PromptBlock
          key={prompt.itemId}
          index={index + 1}
          prompt={prompt}
          playback={submission.playback?.[prompt.assetId] ?? null}
          playbackKnown={submission.playback !== null}
          snapshot={snapshot}
          marks={marksOf(marks, prompt.itemId)}
          onMark={(criterionId, mark) => onMark(markKey(prompt.itemId, criterionId), mark)}
          comment={
            editable
              ? (comments[prompt.itemId] ?? '')
              : (decided.get(prompt.itemId)?.comment ?? comments[prompt.itemId] ?? '')
          }
          onComment={(value) => onComment(prompt.itemId, value)}
          editable={editable}
          fallbackLabel={t('promptFallback', { n: index + 1 })}
        />
      ))}
    </section>
  );
}

function promptsOf(submission: ReviewSubmission, details: ReadAloudDetails | null): PromptView[] {
  const byItem = new Map((details?.prompts ?? []).map((p) => [p.itemId, p]));
  const recordings = readSubmission(submission.submittedAnswer)?.recordings ?? [];

  if (recordings.length > 0) {
    return recordings.map((recording) => {
      const detail = byItem.get(recording.itemId) ?? null;
      return {
        itemId: recording.itemId,
        label: detail?.label ?? '',
        detail,
        assetId: recording.assetId,
        seconds: recording.seconds,
        takes: recording.takes,
      };
    });
  }

  return (details?.prompts ?? []).map((detail) => ({
    itemId: detail.itemId,
    label: detail.label,
    detail,
    assetId: detail.recording.assetId,
    seconds: detail.recording.seconds,
    takes: detail.recording.takes,
  }));
}

/** `ra-qcard`: one prompt, its recording and its marking. */
function PromptBlock({
  index,
  prompt,
  playback,
  playbackKnown,
  snapshot,
  marks,
  onMark,
  comment,
  onComment,
  editable,
  fallbackLabel,
}: {
  index: number;
  prompt: PromptView;
  playback: ReviewPlayback | null;
  playbackKnown: boolean;
  snapshot: SpeakingSnapshot;
  marks: RubricMarks;
  onMark: (criterionId: string, mark: number) => void;
  comment: string;
  onComment: (value: string | undefined) => void;
  editable: boolean;
  fallbackLabel: string;
}) {
  const t = useTranslations('Review.readAloud');
  const outcome = scoreRubric(snapshot, marks);
  const label = prompt.label.trim() === '' ? fallbackLabel : prompt.label;
  const seconds =
    playback?.durationMs != null && playback.durationMs > 0
      ? playback.durationMs / 1000
      : prompt.seconds;
  const detail = prompt.detail;
  const commentId = `ra-comment-${prompt.itemId}`;
  const commented = comment.trim() !== '';

  return (
    <article
      aria-label={label}
      className="flex flex-col gap-2.5 rounded-(--ssz-radius-md) border bg-(--ssz-bg-surface) p-(--ssz-space-4) shadow-(--ssz-shadow-xs)"
      style={{ borderColor: 'var(--ssz-border-default)' }}
    >
      <header className="flex items-center gap-2.5">
        <div className="min-w-0">
          <p className="text-sm font-bold">
            <span className="tabular-nums">{index}.</span> {label}
          </p>
          <p className="text-[11px] text-(--ssz-text-muted)">
            {t('takes', { count: prompt.takes })}
          </p>
        </div>
        <span className="flex-1" />
        <span
          className="text-xs tabular-nums text-(--ssz-text-muted)"
          style={{ fontFamily: MONO }}
          aria-label={
            outcome.complete
              ? t('scoreOf', { points: outcome.points, max: outcome.max })
              : t('scoreUnset', { max: outcome.max })
          }
        >
          {outcome.complete ? outcome.points : '—'}/{outcome.max}
        </span>
      </header>

      {playbackKnown && playback === null ? (
        <p className="text-[12.5px] text-(--ssz-text-muted)">{t('player.gone')}</p>
      ) : (
        <ReviewTakePlayer
          src={playback?.url ?? null}
          peaks={playback?.peaks ?? null}
          seconds={seconds}
          label={t('player.label')}
        />
      )}

      {detail === null ? (
        <p className="text-[12.5px] text-(--ssz-text-muted)">{t('materialGone')}</p>
      ) : (
        <>
          <Material detail={detail} />
          {detail.note.trim() !== '' && (
            <p className="text-[12.5px] leading-relaxed text-(--ssz-text-secondary)">
              <b>{t('listenFor')}</b> {detail.note}
            </p>
          )}
        </>
      )}

      <fieldset disabled={!editable} className="flex flex-col">
        <legend className="sr-only">{t('rubricOf', { label })}</legend>
        {snapshot.criteria.map((criterion) => (
          <CriterionRow
            key={criterion.id}
            criterion={criterion}
            mark={marks[criterion.id] ?? undefined}
            onMark={(mark) => onMark(criterion.id, mark)}
          />
        ))}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor={commentId} className="text-[12.5px] font-semibold">
          {t('comment.label')}
          <span aria-hidden="true" className="ml-0.5 text-(--ssz-color-error-600)">
            *
          </span>
        </label>
        <textarea
          id={commentId}
          value={comment}
          onChange={(event) => onComment(event.target.value)}
          readOnly={!editable}
          required
          aria-invalid={editable && !commented}
          aria-describedby={editable && !commented ? `${commentId}-msg` : undefined}
          placeholder={editable ? t('comment.placeholder') : undefined}
          rows={3}
          maxLength={2000}
          className={`w-full resize-y rounded-(--ssz-radius-md) border bg-(--ssz-bg-surface) px-3 py-2 text-sm ${FOCUS_RING}`}
          style={{ borderColor: 'var(--ssz-border-default)' }}
        />
        {editable && !commented && (
          <p id={`${commentId}-msg`} className="text-[11.5px] text-(--ssz-color-error-600)">
            {t('comment.required')}
          </p>
        )}
      </div>
    </article>
  );
}

/** What the student was looking at: the passage with focus words, the plan, or the turn. */
function Material({ detail }: { detail: ReadAloudPromptDetail }) {
  const t = useTranslations('Review.readAloud');
  const material = detail.material;
  if (material === null)
    return <p className="text-[12.5px] text-(--ssz-text-muted)">{t('materialGone')}</p>;

  const box = 'rounded-(--ssz-radius-md) border bg-(--ssz-bg-base) px-3.5 py-3';

  if (material.kind === 'read') {
    const focus = new Map(detail.focus.map((f) => [wordKey(f.word), f]));
    return (
      <div className={box} style={{ borderColor: 'var(--ssz-border-default)' }}>
        <p className="m-0 text-lg leading-relaxed" style={{ fontFamily: READING }}>
          {passagePieces(material.text).map((piece, i) => {
            const hit = piece.word === undefined ? undefined : focus.get(wordKey(piece.word));
            return hit === undefined ? (
              <span key={i}>{piece.text}</span>
            ) : (
              <mark
                key={i}
                title={hit.note || undefined}
                className="rounded-[4px] px-[3px]"
                style={{
                  background: 'var(--ssz-color-primary-100)',
                  color: 'var(--ssz-color-primary-800)',
                }}
              >
                {piece.text}
              </mark>
            );
          })}
        </p>
      </div>
    );
  }

  if (material.kind === 'dialogue') {
    return (
      <div
        className={`${box} flex flex-col gap-1.5 text-sm`}
        style={{ borderColor: 'var(--ssz-border-default)' }}
      >
        {material.situation.trim() !== '' && (
          <p className="m-0">
            <b>{t('situation')}</b> {material.situation}
          </p>
        )}
        {material.partner.trim() !== '' && (
          <p className="m-0" style={{ fontFamily: READING }}>
            <b style={{ fontFamily: 'inherit' }}>{t('partner')}</b> «{material.partner}»
          </p>
        )}
      </div>
    );
  }

  if (material.plan.length === 0 && material.image === null) return null;
  return (
    <div
      className={`${box} flex flex-col gap-1.5 text-sm`}
      style={{ borderColor: 'var(--ssz-border-default)' }}
    >
      {material.image !== null && material.image.caption.trim() !== '' && (
        <p className="m-0">
          <b>{t('picture')}</b> {material.image.caption}
        </p>
      )}
      {material.plan.length > 0 && (
        <>
          <b>{t('plan')}</b>
          <ul className="m-0 list-disc pl-5">
            {material.plan.map((point) => (
              <li key={point.id}>{point.text}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** `ra-qgrid`: the criterion and the descriptor of the level given, the 0–3 segment beside it. */
function CriterionRow({
  criterion,
  mark,
  onMark,
}: {
  criterion: SpeakingCriterion;
  mark: number | undefined;
  onMark: (mark: number) => void;
}) {
  const t = useTranslations('Review.rubric');
  const name = criterion.name.trim() === '' ? t('unnamed') : criterion.name;
  const set = mark !== undefined;

  return (
    <div
      className="grid items-center gap-2.5 border-t py-2"
      style={{
        gridTemplateColumns: 'minmax(0,1fr) auto',
        borderColor: 'var(--ssz-border-default)',
      }}
    >
      <div className="min-w-0">
        <strong className="block text-sm">
          {name}{' '}
          <span
            className="text-[11px] font-normal text-(--ssz-text-muted)"
            style={{ fontFamily: MONO }}
          >
            ×{criterion.weight}
          </span>
        </strong>
        {/* The descriptor of the level given — the sentence two teachers agree on. Before a
            mark there is none, so the criterion says what it is about. */}
        <span className="mt-0.5 block text-xs text-(--ssz-text-secondary)">
          {set ? criterion.levels[mark]?.trim() || '—' : criterion.desc || t('unmarked')}
        </span>
      </div>
      <div
        role="group"
        aria-label={t('markOf', { name })}
        className="inline-flex gap-0.5 rounded-(--ssz-radius-sm) border bg-(--ssz-bg-subtle) p-0.5"
        style={{ borderColor: 'var(--ssz-border-default)' }}
      >
        {LEVELS.map((level) => {
          const on = mark === level;
          return (
            <button
              key={level}
              type="button"
              aria-pressed={on}
              onClick={() => onMark(level)}
              className={`min-w-[30px] rounded-(--ssz-radius-xs) px-0 py-1 text-[11px] font-bold disabled:cursor-default ${FOCUS_RING}`}
              style={{
                fontFamily: MONO,
                background: on ? 'var(--ssz-color-primary-500)' : 'transparent',
                color: on ? '#fff' : 'var(--ssz-text-secondary)',
              }}
            >
              {level}
            </button>
          );
        })}
      </div>
    </div>
  );
}
