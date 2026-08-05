'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

export interface SchemaField {
  id: string;
  label: string;
}
export interface SchemaToken {
  id: string;
  text: string;
}

/**
 * Content schema for sentence-schema (setningsskjema) exercises.
 * The learner places each token into one of the ordered fields.
 */
export interface SentenceSchemaContent {
  /** The target sentence. Held back while `source_sentence` is set. */
  sentence: string;
  /**
   * The sentence the learner starts from — a main clause to subordinate, or a
   * neutral order to front an adverbial in. When present the task is a
   * transformation, so the target sentence only appears with the feedback.
   */
  source_sentence?: string;
  schema_type?: 'main' | 'subordinate';
  fields: SchemaField[];
  tokens: SchemaToken[];
  instruction?: string;
}

export interface SentenceSchemaExpectedAnswers {
  placements: Array<{ field_id: string; token_ids: string[] }>;
  explanation?: string;
}

/** Placement map: field id → ordered token ids currently in that field. */
export type SchemaPlacements = Record<string, string[]>;

export interface SentenceSchemaBodyProps {
  content: SentenceSchemaContent;
  value: SchemaPlacements;
  onValueChange: (val: SchemaPlacements) => void;
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
  /**
   * The expected placement, rendered as a read-only row below the learner's
   * own. Pass it only once the answer has been unlocked; `null` keeps it back.
   */
  revealPlacements?: SchemaPlacements | null;
}

const READING = 'var(--ssz-font-reading)';
/** Pointer travel (px) before a press turns into a drag instead of a tap. */
const DRAG_THRESHOLD = 5;

/** Where a token currently lives: a field id, or `null` for the bank. */
type TokenHome = string | null;

interface DragState {
  tokenId: string;
  pointerId: number;
  from: TokenHome;
  /** Index the token had inside `from`, or -1 when it came from the bank. */
  fromIndex: number;
  /** Current pointer position and the grab offset inside the chip. */
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/** Drop target under the pointer: a field and the insertion slot inside it. */
interface DropTarget {
  fieldId: string;
  index: number;
}

/**
 * Deterministic shuffle of the token bank. Handing the words out in sentence
 * order turns the task into copying, and `Math.random` would break hydration,
 * so the permutation is derived from the tokens themselves.
 */
function shuffledTokens(tokens: SchemaToken[]): SchemaToken[] {
  let seed = 2166136261;
  for (const tk of tokens) {
    for (const s of [tk.id, tk.text]) {
      for (let i = 0; i < s.length; i += 1) {
        seed = Math.imul(seed ^ s.charCodeAt(i), 16777619);
      }
    }
  }
  const out = [...tokens];
  let state = seed >>> 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j] as SchemaToken, out[i] as SchemaToken];
  }
  return out;
}

/** All token ids currently placed in any field. */
function placedIds(value: SchemaPlacements): Set<string> {
  const ids = new Set<string>();
  for (const list of Object.values(value)) for (const id of list) ids.add(id);
  return ids;
}

function removeEverywhere(value: SchemaPlacements, tokenId: string): SchemaPlacements {
  const out: SchemaPlacements = {};
  for (const [fieldId, list] of Object.entries(value)) out[fieldId] = list.filter((id) => id !== tokenId);
  return out;
}

/**
 * Move a token to `fieldId` at `index` (or back to the bank when `fieldId` is
 * null). When the token only moves inside its own field the index is corrected
 * for the slot it vacates.
 */
function moveToken(
  value: SchemaPlacements,
  tokenId: string,
  fieldId: TokenHome,
  index: number,
  from: TokenHome,
  fromIndex: number,
): SchemaPlacements {
  const cleared = removeEverywhere(value, tokenId);
  if (fieldId === null) return cleared;
  const list = [...(cleared[fieldId] ?? [])];
  let at = index;
  if (from === fieldId && fromIndex > -1 && fromIndex < index) at -= 1;
  list.splice(Math.max(0, Math.min(at, list.length)), 0, tokenId);
  return { ...cleared, [fieldId]: list };
}

export function SentenceSchemaBody({
  content,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  ok,
  mode,
  accent,
  revealPlacements = null,
}: SentenceSchemaBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const isAnswering = phase === 'answering';
  const reveal = phase === 'feedback';
  const accentSoft = modeAccentSoft(mode);
  const [armed, setArmed] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);

  // A press that has not yet travelled far enough to count as a drag.
  const pendingRef = useRef<{ tokenId: string; pointerId: number; x: number; y: number } | null>(null);
  // Set while a drag is in flight so the trailing click does not also fire.
  const draggedRef = useRef(false);
  const fieldRefs = useRef(new Map<string, HTMLDivElement>());
  const chipRefs = useRef(new Map<string, HTMLElement>());

  const placed = useMemo(() => placedIds(value), [value]);
  const bankOrder = useMemo(() => shuffledTokens(content.tokens), [content.tokens]);
  const bank = bankOrder.filter((tk) => !placed.has(tk.id));
  const tokenById = useMemo(
    () => new Map(content.tokens.map((tk) => [tk.id, tk])),
    [content.tokens],
  );

  useEffect(() => {
    onAnswerChange(placed.size === content.tokens.length && content.tokens.length > 0);
  }, [placed, content.tokens.length, onAnswerChange]);

  const homeOf = (tokenId: string): { from: TokenHome; fromIndex: number } => {
    for (const [fieldId, list] of Object.entries(value)) {
      const i = list.indexOf(tokenId);
      if (i > -1) return { from: fieldId, fromIndex: i };
    }
    return { from: null, fromIndex: -1 };
  };

  /** Hit-test the pointer against the field zones and their chips. */
  const targetAt = (clientX: number, clientY: number): DropTarget | null => {
    for (const [fieldId, el] of fieldRefs.current) {
      const rect = el.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
      const ids = value[fieldId] ?? [];
      let index = ids.length;
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        const chip = id ? chipRefs.current.get(id) : undefined;
        if (!chip) continue;
        const c = chip.getBoundingClientRect();
        // Chips wrap, so a row below the pointer always sorts after it.
        if (clientY < c.top || (clientY <= c.bottom && clientX < c.left + c.width / 2)) {
          index = i;
          break;
        }
      }
      return { fieldId, index };
    }
    return null;
  };

  const startPress = (e: React.PointerEvent, tokenId: string) => {
    if (!isAnswering) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    draggedRef.current = false;
    pendingRef.current = { tokenId, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    // Keep receiving moves once the pointer leaves the chip. Not implemented in jsdom.
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const movePress = (e: React.PointerEvent) => {
    const pending = pendingRef.current;
    if (drag) {
      if (e.pointerId !== drag.pointerId) return;
      setDrag({ ...drag, x: e.clientX, y: e.clientY });
      setTarget(targetAt(e.clientX, e.clientY));
      return;
    }
    if (!pending || e.pointerId !== pending.pointerId) return;
    if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < DRAG_THRESHOLD) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { from, fromIndex } = homeOf(pending.tokenId);
    draggedRef.current = true;
    pendingRef.current = null;
    setArmed(null);
    setDrag({
      tokenId: pending.tokenId,
      pointerId: pending.pointerId,
      from,
      fromIndex,
      x: e.clientX,
      y: e.clientY,
      offsetX: pending.x - rect.left,
      offsetY: pending.y - rect.top,
      width: rect.width,
      height: rect.height,
    });
    setTarget(targetAt(e.clientX, e.clientY));
  };

  const endPress = (e: React.PointerEvent) => {
    if (drag && e.pointerId === drag.pointerId) {
      const drop = targetAt(e.clientX, e.clientY);
      onValueChange(
        moveToken(value, drag.tokenId, drop?.fieldId ?? null, drop?.index ?? 0, drag.from, drag.fromIndex),
      );
      setDrag(null);
      setTarget(null);
      return;
    }
    pendingRef.current = null;
  };

  const cancelPress = () => {
    pendingRef.current = null;
    setDrag(null);
    setTarget(null);
  };

  /** Tap path (also the keyboard path): arm a token, then activate a field. */
  const toggleArmed = (tokenId: string) => {
    if (!isAnswering || draggedRef.current) return;
    setArmed((cur) => (cur === tokenId ? null : tokenId));
  };

  const placeInField = (fieldId: string) => {
    if (!isAnswering || armed === null || draggedRef.current) return;
    const { from, fromIndex } = homeOf(armed);
    onValueChange(moveToken(value, armed, fieldId, (value[fieldId] ?? []).length, from, fromIndex));
    setArmed(null);
  };

  const unplaceToken = (tokenId: string) => {
    if (!isAnswering || draggedRef.current) return;
    setArmed(null);
    onValueChange(removeEverywhere(value, tokenId));
  };

  const borderFor = (base: string) =>
    reveal && ok === true
      ? 'var(--ssz-feedback-ok-line)'
      : reveal && ok === false
        ? 'var(--ssz-feedback-no-line)'
        : base;

  const chipStyle = (highlighted: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 8,
    border: `2px solid ${highlighted ? accent : 'var(--ssz-border-default)'}`,
    background: highlighted ? accentSoft : 'var(--ssz-bg-surface)',
    color: 'var(--ssz-text-primary)',
    fontFamily: READING,
    fontSize: 15,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    touchAction: 'none',
    cursor: isAnswering ? 'grab' : 'default',
  });

  const dragText = drag ? (tokenById.get(drag.tokenId)?.text ?? '') : '';
  const source = content.source_sentence?.trim();

  return (
    <>
      <Instr>{content.instruction ?? t('sentenceSchema.defaultInstruction')}</Instr>

      {/* A transformation task starts from `source_sentence`; the target one
          would give the word order away, so it waits for the feedback. */}
      {source && (
        <>
          <p
            className="mb-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: 'var(--ssz-text-muted)' }}
          >
            {t('sentenceSchema.sourceLabel')}
          </p>
          <p
            className="mb-4 leading-[1.5]"
            style={{ fontFamily: READING, fontSize: 20, fontWeight: 500, color: 'var(--ssz-text-primary)' }}
          >
            {source}
          </p>
        </>
      )}
      {(!source || !isAnswering) && content.sentence && (
        <>
          {source && (
            <p
              className="mb-1 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: 'var(--ssz-text-muted)' }}
            >
              {t('sentenceSchema.targetLabel')}
            </p>
          )}
          <p
            className="mb-4 leading-[1.5]"
            style={{ fontFamily: READING, fontSize: 20, fontWeight: 500, color: 'var(--ssz-text-primary)' }}
          >
            {content.sentence}
          </p>
        </>
      )}

      <p className="mb-2 text-[12px] italic" style={{ color: 'var(--ssz-text-muted)' }}>
        {t('sentenceSchema.multiWordHint')}
      </p>

      {/* Field columns — words stay on one line inside a field, the fields wrap instead. */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {content.fields.map((field) => {
            const tokenIds = value[field.id] ?? [];
            const isTarget = target?.fieldId === field.id;
            const active = isAnswering && (armed !== null || drag !== null);
            return (
              <div
                key={field.id}
                className="flex grow flex-col"
                style={{ flexBasis: '7rem', minWidth: 'fit-content' }}
              >
                <p
                  className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: 'var(--ssz-text-muted)' }}
                >
                  {field.label}
                </p>
                <div
                  ref={(el) => {
                    if (el) fieldRefs.current.set(field.id, el);
                    else fieldRefs.current.delete(field.id);
                  }}
                  role="button"
                  tabIndex={isAnswering ? 0 : -1}
                  aria-disabled={!isAnswering || armed === null}
                  aria-label={t('sentenceSchema.fieldDropLabel', { field: field.label })}
                  onClick={() => placeInField(field.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      placeInField(field.id);
                    }
                  }}
                  style={{
                    minHeight: 56,
                    borderRadius: 10,
                    border: `2px dashed ${borderFor(isTarget ? accent : 'var(--ssz-border-default)')}`,
                    background: isTarget ? accentSoft : active ? accentSoft : 'var(--ssz-bg-subtle)',
                    padding: 6,
                    cursor: active ? 'pointer' : 'default',
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
                >
                  {tokenIds.map((id, i) => (
                    <span key={id} className="contents">
                      {isTarget && target.index === i && (
                        <span
                          aria-hidden
                          style={{ width: 3, borderRadius: 2, background: accent, alignSelf: 'stretch', minHeight: 32 }}
                        />
                      )}
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) chipRefs.current.set(id, el);
                          else chipRefs.current.delete(id);
                        }}
                        disabled={!isAnswering}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          startPress(e, id);
                        }}
                        onPointerMove={movePress}
                        onPointerUp={(e) => {
                          e.stopPropagation();
                          endPress(e);
                        }}
                        onPointerCancel={cancelPress}
                        onClick={(e) => {
                          e.stopPropagation();
                          unplaceToken(id);
                        }}
                        style={{
                          ...chipStyle(true),
                          opacity: drag?.tokenId === id ? 0.35 : 1,
                        }}
                      >
                        {tokenById.get(id)?.text ?? ''}
                      </button>
                    </span>
                  ))}
                  {isTarget && target.index >= tokenIds.length && (
                    <span
                      aria-hidden
                      style={{ width: 3, borderRadius: 2, background: accent, alignSelf: 'stretch', minHeight: 32 }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Token bank */}
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--ssz-text-muted)' }}>
        {t('sentenceSchema.bankLabel')}
      </p>
      <div className="flex flex-wrap gap-2" aria-label={t('sentenceSchema.bankLabel')}>
        {bank.length === 0 && (
          <span className="text-[13px] italic" style={{ color: 'var(--ssz-text-muted)' }}>
            {t('sentenceSchema.bankEmpty')}
          </span>
        )}
        {bank.map((tk) => {
          const isArmed = armed === tk.id;
          return (
            <button
              key={tk.id}
              type="button"
              disabled={!isAnswering}
              aria-pressed={isArmed}
              onPointerDown={(e) => startPress(e, tk.id)}
              onPointerMove={movePress}
              onPointerUp={endPress}
              onPointerCancel={cancelPress}
              onClick={() => toggleArmed(tk.id)}
              style={{
                ...chipStyle(isArmed),
                padding: '9px 16px',
                borderRadius: 10,
                fontSize: 16,
                color: isArmed ? accent : 'var(--ssz-text-primary)',
                opacity: drag?.tokenId === tk.id ? 0.35 : 1,
              }}
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
            >
              {tk.text}
            </button>
          );
        })}
      </div>

      {/* The expected placement, once the learner has unlocked the answer. */}
      {revealPlacements && (
        <div className="mt-5">
          <p
            className="mb-1.5 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: 'var(--ssz-text-muted)' }}
          >
            {t('sentenceSchema.answerLabel')}
          </p>
          <div className="flex flex-wrap gap-2">
            {content.fields.map((field) => (
              <div
                key={field.id}
                className="flex grow flex-col"
                style={{ flexBasis: '7rem', minWidth: 'fit-content' }}
              >
                <p
                  className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: 'var(--ssz-text-muted)' }}
                >
                  {field.label}
                </p>
                <div
                  style={{
                    minHeight: 56,
                    borderRadius: 10,
                    border: '2px dashed var(--ssz-feedback-ok-line)',
                    background: 'var(--ssz-feedback-ok-bg)',
                    padding: 6,
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {(revealPlacements[field.id] ?? []).map((id) => (
                    <span
                      key={id}
                      style={{
                        ...chipStyle(false),
                        border: '2px solid var(--ssz-feedback-ok-line)',
                        color: 'var(--ssz-feedback-ok-fg)',
                        cursor: 'default',
                      }}
                    >
                      {tokenById.get(id)?.text ?? ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chip following the pointer while dragging. */}
      {drag &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-hidden
            style={{
              ...chipStyle(true),
              position: 'fixed',
              left: drag.x - drag.offsetX,
              top: drag.y - drag.offsetY,
              minWidth: drag.width,
              height: drag.height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 70,
              cursor: 'grabbing',
              boxShadow: '0 8px 20px rgb(0 0 0 / 0.25)',
            }}
          >
            {dragText}
          </div>,
          document.body,
        )}
    </>
  );
}
