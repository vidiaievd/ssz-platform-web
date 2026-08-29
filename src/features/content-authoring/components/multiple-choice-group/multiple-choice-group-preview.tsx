'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Shuffle as ShuffleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  carryOver,
  check,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  type CheckResult,
  type MultipleChoiceGroupContent,
} from '@/lib/shared-kernel/multiple-choice-group';
import {
  MultipleChoiceGroupBody,
  type MultipleChoiceGroupPhase,
} from '@/features/student/exercises/runner/multiple-choice-group-body';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';
import type { MultipleChoiceGroupSubmitDetails } from '@/features/student/exercises/types/attempts';

export interface MultipleChoiceGroupPreviewProps {
  exercise: MultipleChoiceGroupContent;
}

/**
 * The student's view of the table the teacher is building — the actual runner body, not a
 * lookalike. IMPLEMENTATION.md is explicit that preview and student view mount the same
 * runner; the first time a copy drifted, the preview would be lying about the product.
 *
 * It goes through `toStudentProjection` rather than handing the document over, and that is
 * the point of the panel rather than a detail of it. The projection is what takes the key
 * away — which column is right, the author's line, the quote that proves it — and it is
 * also what drops the half-written rows and settles the row order. An author who wonders
 * what their student is actually handed is asking a question only this panel can answer,
 * because half the answer is made by ten switches a step away.
 *
 * **The verdict is real.** It runs the kernel's own `check` — the same function the engine
 * calls — because the teacher owns the key, so judging in their browser reveals nothing to
 * anybody. It is the only way the panel answers the question the author actually has:
 * whether the retry they left on reopens what they meant, whether the frozen rows are the
 * right ones, and what a wrong row is told at the moment it is told.
 *
 * What it is not is an attempt. Nothing is recorded, no score leaves this component, and
 * `Neste oppgave` is not drawn here any more than it is in the player (plan 54 §5).
 */
export function MultipleChoiceGroupPreview({ exercise }: MultipleChoiceGroupPreviewProps) {
  const t = useTranslations('Authoring');

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<MultipleChoiceGroupPhase>('answering');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const [firstAnswers, setFirstAnswers] = useState<Record<string, string | null>>({});
  const [attempt, setAttempt] = useState(1);
  /** Bumped by the reshuffle button; nothing else may re-deal the rows. */
  const [seed, setSeed] = useState(1);

  /*
    Seeded rather than random, and that is not a nicety: this panel re-renders on every
    keystroke in the editor column, and a `Math.random` shuffle would deal the rows again
    on each one — the author would watch their statements jump while typing them.
  */
  const projection = useMemo(
    () => toStudentProjection(toContent(exercise), toExpectedAnswers(exercise), shuffleWith(seed)),
    [exercise, seed],
  );

  /**
   * When the table changes under the runner, the attempt starts again.
   *
   * Done during render rather than in an effect: an effect would paint one frame of a
   * judged table against a set of rows that has just changed, and that frame is exactly
   * the moment an author's row becomes answerable. The signature covers what the rows
   * *are* and the settings that decide what a check may do — the two things that would
   * make a standing verdict a lie.
   */
  const signature = [
    projection.rows.map((row) => row.id).join(','),
    exercise.columns.map((column) => column.id).join(','),
    exercise.settings.retry,
    String(exercise.settings.lockCorrect),
    String(exercise.settings.revealKey),
    exercise.settings.showWhy,
    String(exercise.settings.passThreshold),
  ].join('|');
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    restart();
  }

  function restart() {
    setAnswers({});
    setResult(null);
    setLocked([]);
    setFirstAnswers({});
    setAttempt(1);
    setPhase('answering');
  }

  /**
   * Check the table, or ask to be shown it.
   *
   * The same call the engine makes, with the same dosing: the right column, the line and
   * the quote come back only once the table is closed, so the panel cannot show the author
   * something a student would not be shown at that moment. `firstAnswer` is carried
   * forward here the way the engine carries it between checks.
   */
  const send = (reveal = false) => {
    const verdict = check({ ex: exercise, answers, attempt, reveal, locked });
    const first = { ...firstAnswers };
    for (const row of verdict.rows) {
      if (!(row.rowId in first)) first[row.rowId] = row.answer;
    }
    setFirstAnswers(first);
    setResult(verdict);
    setLocked(verdict.locked);
    setPhase('checked');
  };

  const retry = () => {
    setAnswers(carryOver(exercise, answers));
    setResult(null);
    setAttempt(attempt + 1);
    setPhase('answering');
  };

  // Every hook has run by here. The empty state is a render, never an early return — a
  // table with nothing finished in it is the normal state of a half-written exercise.
  if (projection.rows.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        {t('multipleChoiceGroup.preview.empty')}
      </p>
    );
  }

  const details: MultipleChoiceGroupSubmitDetails | null =
    result === null
      ? null
      : {
          totalItems: result.total,
          passedItems: result.correct,
          attempt: result.attempt,
          attemptsLeft: result.attemptsLeft,
          closed: result.closed,
          locked: result.locked,
          items: result.rows.map((row) => ({
            itemId: row.rowId,
            submitted: row.answer,
            correct: row.correct,
            firstAnswer: firstAnswers[row.rowId] ?? row.answer,
            ...(row.keyColumnId === undefined ? {} : { keyColumnId: row.keyColumnId }),
            ...(row.why === undefined ? {} : { why: row.why }),
            ...(row.quote === undefined ? {} : { quote: row.quote }),
          })),
        };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <MultipleChoiceGroupBody
        projection={projection}
        answers={answers}
        onPick={(rowId, columnId) =>
          // Functionally, as IMPLEMENTATION.md asks: two picks in the same tick with a
          // spread of the closure value lose the first one.
          setAnswers((current) => ({ ...current, [rowId]: columnId }))
        }
        phase={phase}
        verdict={details}
        locked={locked}
        interactive
        onCheck={() => send()}
        onRetry={retry}
        onReveal={() => send(true)}
        onFinish={() => setPhase('done')}
        onRestart={restart}
        accent={PRACTICE_ACCENT}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{t('multipleChoiceGroup.preview.live')}</p>
        {exercise.settings.shuffleRows && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setSeed(seed + 1)}>
            <ShuffleIcon className="size-3.5" aria-hidden />
            {t('multipleChoiceGroup.preview.reshuffle')}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * A deterministic shuffle for one render of the panel.
 *
 * The kernel takes the ordering as a parameter precisely so the server can seed it per
 * attempt and this panel can hold it still between keystrokes. Quality is irrelevant here
 * — it deals rows a teacher looks at — and repeatability is the whole requirement.
 */
function shuffleWith(seed: number) {
  return <T,>(items: readonly T[]): T[] => {
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
