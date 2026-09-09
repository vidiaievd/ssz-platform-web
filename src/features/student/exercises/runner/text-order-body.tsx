'use client';

import { useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  AudioLockNote,
  AudioTranscript,
  ExerciseAudioPlayer,
  type ExerciseAudioEngine,
} from '@/features/student/exercises/audio';

import { Instr } from './instr';
import { type RunnerMode, type RunnerPhase } from './types';

export interface OrderLine {
  id: string;
  text: string;
  /** Speaker label for dialogues, e.g. "Marina". */
  speaker?: string;
}

export interface TextOrderContent {
  items: OrderLine[];
  /** Presentation hint only — scoring is identical either way. */
  kind?: 'dialogue' | 'sentences';
  instruction?: string;
}

export interface TextOrderExpectedAnswers {
  /** Item ids, first to last. */
  order: string[];
  explanation?: string;
}

/** itemId → placed in its own slot; only present in the feedback phase. */
export type TextOrderResults = Record<string, boolean>;

export interface TextOrderBodyProps {
  content: TextOrderContent;
  /**
   * The listening layer, when the exercise has one (plan 56 phase 6).
   *
   * This type gets the player, the gate and the transcript — and deliberately **not** the
   * fragment chips. A timecode beside each line would order the lines: the puzzle is that
   * they arrive shuffled, and "0:12" next to one and "0:31" next to another answers it.
   */
  audio?: ExerciseAudioEngine;
  /** What the clip said, delivered with the key once the order has been checked. */
  audioTranscript?: { transcript: string; translation: string } | null;
  /** Current order, as item ids. */
  value: string[];
  onValueChange: (value: string[]) => void;
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  /** null in graded mode — the body never reveals correctness there. */
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
  results?: TextOrderResults;
}

const OK_LINE = 'var(--ssz-feedback-ok-line)';
const OK_BG = 'var(--ssz-feedback-ok-bg)';
const NO_LINE = 'var(--ssz-feedback-no-line)';
const NO_BG = 'var(--ssz-feedback-no-bg)';
const READING = 'var(--ssz-font-reading)';

/**
 * Deterministic shuffle from an item list — same exercise, same starting order,
 * so a learner who reloads doesn't get a different puzzle. Never returns the
 * expected order itself for lists of two or more.
 */
export function shuffleOrder(ids: string[], seed: string): string[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };

  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // A shuffle that lands on the original order would hand the learner the
  // answer; rotating by one keeps it deterministic and always different.
  if (out.length > 1 && out.every((id, i) => id === ids[i])) {
    out.push(out.shift()!);
  }
  return out;
}

interface LineProps {
  line: OrderLine;
  position: number;
  total: number;
  reveal: boolean;
  result?: boolean;
  onMove: (delta: number) => void;
  accent: string;
}

function SortableLine({ line, position, total, reveal, result, onMove, accent }: LineProps) {
  const t = useTranslations('ExerciseRunner');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: line.id,
    disabled: reveal,
  });

  const tone =
    reveal && result !== undefined
      ? result
        ? { border: OK_LINE, bg: OK_BG }
        : { border: NO_LINE, bg: NO_BG }
      : { border: 'var(--ssz-border-default)', bg: 'var(--ssz-bg-surface)' };

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        borderColor: tone.border,
        background: tone.bg,
      }}
      className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
    >
      <span className="w-5 shrink-0 text-[12px] font-semibold text-(--ssz-text-muted)">
        {position}.
      </span>

      {!reveal && (
        <button
          type="button"
          className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label={t('textOrder.dragHandle', { n: position, total })}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>
      )}

      <p
        className="min-w-0 flex-1 text-[15px] leading-snug"
        style={{ fontFamily: READING, color: 'var(--ssz-text-primary)' }}
      >
        {line.speaker && (
          <span className="mr-1.5 font-semibold" style={{ color: accent }}>
            {line.speaker}:
          </span>
        )}
        {line.text}
      </p>

      {!reveal && (
        <span className="flex shrink-0 flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={position === 1}
            aria-label={t('textOrder.moveUp')}
            className="rounded p-0.5 text-muted-foreground hover:bg-subtle disabled:opacity-30"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={position === total}
            aria-label={t('textOrder.moveDown')}
            className="rounded p-0.5 text-muted-foreground hover:bg-subtle disabled:opacity-30"
          >
            <ChevronDown size={14} />
          </button>
        </span>
      )}
    </li>
  );
}

export function TextOrderBody({
  content,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  ok,
  accent,
  results,
  audio,
  audioTranscript = null,
}: TextOrderBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const reveal = phase === 'feedback';
  const audioOn = audio !== undefined && audio.audio.enabled;
  // Joined to the expression the lines already read: `reveal` is what takes their handles
  // away, and a gate that added a second one would be a second thing to keep in step.
  const locked = audioOn && audio.gated;
  const byId = new Map(content.items.map((i) => [i.id, i]));
  const lines = value.map((id) => byId.get(id)).filter((l): l is OrderLine => l != null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Any arrangement is submittable: the learner is never blocked from checking.
  useEffect(() => {
    onAnswerChange(lines.length > 0);
  }, [lines.length, onAnswerChange]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = value.indexOf(String(active.id));
    const to = value.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onValueChange(arrayMove(value, from, to));
  }

  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= value.length) return;
    onValueChange(arrayMove(value, index, to));
  }

  return (
    <div>
      {content.instruction && <Instr>{content.instruction}</Instr>}

      {audioOn && (
        <div className="mb-3">
          <ExerciseAudioPlayer eng={audio} interactive={!reveal} />
          {locked && <AudioLockNote itemNoun={t('audio.itemNoun.lines')} />}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2">
            {lines.map((line, i) => (
              <SortableLine
                key={line.id}
                line={line}
                position={i + 1}
                total={lines.length}
                reveal={reveal || locked}
                result={reveal && ok !== null ? results?.[line.id] : undefined}
                onMove={(delta) => move(i, delta)}
                accent={accent}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

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
