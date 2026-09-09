'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Shuffle as ShuffleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  deliverableRows,
  fieldsFor,
  grade,
  keepCorrect,
  revealRow,
  toStudentProjection,
  toStudentResult,
  type GradeResult,
  type Placement,
  type SentenceSchemaContent,
  type StudentResult,
} from '@/lib/shared-kernel/sentence-schema';
import {
  SentenceSchemaBody,
  type SentenceSchemaPhase,
} from '@/features/student/exercises/runner/sentence-schema-body';
import {
  deferPosition,
  nextPosition,
} from '@/features/student/exercises/runner/sentence-set-order';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';

export interface SentenceSchemaPreviewProps {
  exercise: SentenceSchemaContent;
}

/**
 * The student's view of what the teacher is building — the actual runner body, not a
 * lookalike. There is one implementation of the student view and there should not be a
 * second; the first time a copy drifted, the preview would be lying about the product.
 *
 * It goes through `toStudentProjection` rather than handing the document over, and that is
 * the point of the panel rather than a detail of it. The projection is what takes the key
 * away — which field each chunk belongs in, the alternatives, the rule, the sentence in
 * its correct order — and it is also what *assembles* the bank. An author who wonders what
 * their student is actually handed is asking a question only this panel can answer,
 * because half the answer is made by three switches two steps away.
 *
 * **The verdict is real.** It runs the kernel's own `grade` — the same function the server
 * calls — because the teacher owns the key, so grading in their browser reveals nothing to
 * anybody. It is the only way the panel answers the question the author has, which is
 * whether the schema they wrote actually marks the sentence they meant.
 */
export function SentenceSchemaPreview({ exercise }: SentenceSchemaPreviewProps) {
  const t = useTranslations('Authoring');

  const [index, setIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement>({});
  const [phase, setPhase] = useState<SentenceSchemaPhase>('placing');
  const [attempt, setAttempt] = useState(1);
  const [marks, setMarks] = useState<GradeResult | null>(null);
  const [result, setResult] = useState<StudentResult | null>(null);
  const [tally, setTally] = useState({ solved: 0, revealed: 0, skipped: 0 });
  /** Sentences put aside, and every one ever put aside — see `sentence-set-order.ts`. */
  const [deferred, setDeferred] = useState<string[]>([]);
  const [everDeferred, setEverDeferred] = useState<string[]>([]);
  /** Bumped by the reshuffle button; nothing else may change the bank's order. */
  const [seed, setSeed] = useState(1);

  /** The rows with their key, in the order the projection has them. */
  const rows = useMemo(() => deliverableRows(exercise), [exercise]);

  /*
    Seeded rather than random, and that is not a nicety: this panel re-renders on every
    keystroke in the editor column, and a `Math.random` shuffle would deal the bank again
    on each one — the author would be watching the words jump while typing the sentence
    they belong to.
  */
  const projection = useMemo(
    () => toStudentProjection(exercise, shuffleWith(seed)),
    [exercise, seed],
  );

  /**
   * BEHAVIOR §"Builder · preview": the attempt resets when the sentence set changes or
   * when `prefill`, `extras` or `shuffle` move. Done during render rather than in an
   * effect — an effect would paint one frame of the old board against the new sentence,
   * and that frame is exactly the moment an author's placement becomes playable.
   */
  const signature = [
    projection.rows.length,
    projection.rows[Math.min(index, projection.rows.length - 1)]?.id ?? '',
    exercise.settings.prefill,
    String(exercise.settings.extras),
    String(exercise.settings.shuffle),
  ].join('|');
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    const first = projection.rows[Math.min(index, projection.rows.length - 1)];
    setPlacement(first?.start ?? {});
    setPhase('placing');
    setAttempt(1);
    setMarks(null);
    setResult(null);
  }

  const row = projection.rows[index];
  const keyRow = rows[index];

  const check = () => {
    if (!row || !keyRow) return;
    const fields = fieldsFor(exercise, keyRow);
    const outcome = grade(keyRow, fields, placement, exercise.settings);
    setMarks(outcome);
    setResult(
      toStudentResult({
        row: keyRow,
        fields,
        marks: outcome,
        settings: exercise.settings,
        attempt,
        revealed: false,
      }),
    );
    if (outcome.solved) {
      setTally((current) => ({ ...current, solved: current.solved + 1 }));
      setPhase('closed');
      return;
    }
    setPhase('checked');
  };

  const retry = () => {
    if (marks === null) return;
    setPlacement(keepCorrect(placement, marks));
    setAttempt(attempt + 1);
    setPhase('placing');
  };

  const reveal = () => {
    if (!keyRow) return;
    const shown = revealRow(keyRow, fieldsFor(exercise, keyRow), exercise.settings, attempt);
    setPlacement(shown.placement);
    setResult(shown.result);
    setTally((current) => ({ ...current, revealed: current.revealed + 1 }));
    setPhase('closed');
  };

  const position = {
    ids: projection.rows.map((r) => r.id),
    index,
    isClosed: () => false,
    deferred,
  };

  const move = (step: ReturnType<typeof nextPosition>) => {
    setDeferred(step.deferred);
    if (step.index === null) {
      setPhase('done');
      return;
    }
    setIndex(step.index);
    setPlacement(projection.rows[step.index]?.start ?? {});
    setPhase('placing');
    setAttempt(1);
    setMarks(null);
    setResult(null);
  };

  const next = () => move(nextPosition(position));

  const skip = () => {
    const current = projection.rows[index];
    if (current === undefined) return;
    // Read before, written after — see the same note in `sentence-schema-solver.tsx`.
    move(deferPosition(position, everDeferred));
    if (!everDeferred.includes(current.id)) setEverDeferred([...everDeferred, current.id]);
    setTally((t) => ({ ...t, skipped: t.skipped + 1 }));
  };

  const restart = () => {
    setIndex(0);
    setPlacement(projection.rows[0]?.start ?? {});
    setPhase('placing');
    setAttempt(1);
    setMarks(null);
    setResult(null);
    setTally({ solved: 0, revealed: 0, skipped: 0 });
  };

  // Every hook has run by here. The empty state is a render, never an early return — a set
  // with nothing finished in it is the normal state of a half-written exercise, and
  // IMPLEMENTATION.md warns about exactly this shape.
  if (row === undefined) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        {t('sentenceSchema.preview.empty')}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <SentenceSchemaBody
        row={row}
        settings={projection.settings}
        index={index}
        total={projection.rows.length}
        instruction={projection.instruction}
        placement={placement}
        onPlacementChange={(next) => {
          setPlacement(next);
          // Marks are transient: a board edited after a check is a board whose marks are
          // about something else.
          if (phase === 'checked') setPhase('placing');
        }}
        phase={phase}
        attempt={attempt}
        result={result}
        tally={tally}
        interactive
        onCheck={check}
        onRetry={retry}
        onReveal={reveal}
        onNext={next}
        onSkip={projection.rows.length > 1 ? skip : undefined}
        lastSentence={nextPosition(position).index === null}
        deferred={everDeferred.includes(row.id)}
        onRestart={restart}
        accent={PRACTICE_ACCENT}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{t('sentenceSchema.preview.live')}</p>
        {exercise.settings.shuffle && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setSeed(seed + 1)}>
            <ShuffleIcon className="size-3.5" aria-hidden />
            {t('sentenceSchema.preview.reshuffle')}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * A deterministic shuffle for one render of the panel.
 *
 * The kernel takes the randomness as a parameter precisely so the server can seed it per
 * attempt and this panel can hold it still between keystrokes. Quality is irrelevant here
 * — it deals a bank a teacher looks at — and repeatability is the whole requirement.
 */
function shuffleWith(seed: number) {
  return <T,>(items: T[]): T[] => {
    let state = seed * 2654435761;
    const next = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
}
