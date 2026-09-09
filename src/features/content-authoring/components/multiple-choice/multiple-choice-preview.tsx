'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Shuffle as ShuffleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  answerableQuestions,
  judge,
  toContent,
  toStudentProjection,
  type MultipleChoiceContent,
} from '@/lib/shared-kernel/multiple-choice';
import {
  MultipleChoiceBody,
  type MultipleChoicePhase,
} from '@/features/student/exercises/runner/multiple-choice-body';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';
import type { MultipleChoiceResult } from '@/features/student/exercises/types/attempts';

export interface MultipleChoicePreviewProps {
  exercise: MultipleChoiceContent;
}

/**
 * The student's view of what the teacher is building — the actual runner body, not a
 * lookalike. IMPLEMENTATION.md is explicit that there is one implementation of the student
 * view and there should not be a second; the first time a copy drifted, the preview would
 * be lying about the product.
 *
 * It goes through `toStudentProjection` rather than handing the document over, and that is
 * the point of the panel rather than a detail of it. The projection is what takes the key
 * away — which option is right, the rule, every rebuttal — and it is also what drops the
 * empty options and renumbers the letters. An author who wonders what their student is
 * actually handed is asking a question only this panel can answer, because half the answer
 * is made by six switches a step away.
 *
 * **The verdict is real.** It runs the kernel's own `judge` — the same function the engine
 * calls — because the teacher owns the key, so judging in their browser reveals nothing to
 * anybody. It is the only way the panel answers the question the author has, which is
 * whether the set they wrote plays the way they meant: whether the 50/50 leaves anything
 * to choose between, whether a retry is offered, what a wrong pick is actually told.
 *
 * What it is not is an attempt. Nothing is recorded, no score leaves this component, and
 * `Neste oppgave` is not drawn here any more than it is in the player (plan 53 §5).
 */
export function MultipleChoicePreview({ exercise }: MultipleChoicePreviewProps) {
  const t = useTranslations('Authoring');

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [phase, setPhase] = useState<MultipleChoicePhase>('picking');
  const [result, setResult] = useState<MultipleChoiceResult | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  /** Bumped by the reshuffle button; nothing else may re-deal the options. */
  const [seed, setSeed] = useState(1);

  /**
   * The questions that can actually be answered, exactly as the engine picks them.
   *
   * `isAnswerable` needs the key, so it runs on the document rather than on the
   * projection, and the projection is then narrowed to match — otherwise the two lists
   * drift apart while the author is halfway through writing question three, and the panel
   * shows a question with no right answer in it.
   */
  const ready = useMemo(() => answerableQuestions(exercise), [exercise]);

  /*
    Seeded rather than random, and that is not a nicety: this panel re-renders on every
    keystroke in the editor column, and a `Math.random` shuffle would deal the options
    again on each one — the author would watch the options jump while typing them.
  */
  const projection = useMemo(() => {
    const full = toStudentProjection(toContent(exercise), shuffleWith(seed));
    const answerable = new Set(ready.map((q) => q.id));
    return { ...full, questions: full.questions.filter((q) => answerable.has(q.id)) };
  }, [exercise, ready, seed]);

  /**
   * When the set changes under the runner, the attempt starts again.
   *
   * Done during render rather than in an effect: an effect would paint one frame of the
   * old question against the new set before correcting itself, and that frame is exactly
   * the moment an author's question becomes answerable. The signature covers the settings
   * that change what an open question may do — BEHAVIOR §"Student runner": "changing
   * `shuffle`, `instant` or `retry` while a question is open resets that question's
   * attempt state".
   */
  const signature = [
    projection.questions.length,
    projection.questions[Math.min(index, projection.questions.length - 1)]?.id ?? '',
    String(exercise.settings.shuffle),
    String(exercise.settings.instant),
    exercise.settings.retry,
    String(exercise.settings.eliminate),
  ].join('|');
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setPicked(null);
    setResult(null);
    setPhase('picking');
    setAttempt(1);
    setEliminated([]);
  }

  /*
    The question on screen comes from the projection, and its key from the document by id.
    Two lists in the same order would be an assumption rather than a fact: `shuffleQuestions`
    reorders the projection, and an index read against the author's order would judge one
    question with another's key.
  */
  const shown = projection.questions[Math.min(index, projection.questions.length - 1)];
  const question = ready.find((q) => q.id === shown?.id);

  /**
   * Hand a pick in, or ask to be shown the answer.
   *
   * The same call the engine makes, with the same dosing: `keyOptionId` and the rule come
   * back only once the question is closed, so the panel cannot show the author something a
   * student would not be shown at that moment.
   */
  const send = (optionId: string | null, reveal = false) => {
    if (question === undefined) return;
    const verdict = judge({
      question,
      settings: exercise.settings,
      optionId: optionId ?? '',
      attempt,
      reveal,
      eliminated,
      seed: attempt,
    });
    setResult(verdict);
    setPicked(verdict.optionId === '' ? null : verdict.optionId);
    if (verdict.eliminated !== undefined) setEliminated(verdict.eliminated);
    if (verdict.correct && verdict.attempt === 1) setScore((n) => n + 1);
    setPhase('judged');
  };

  const pick = (optionId: string) => {
    if (phase === 'judged' && result?.closed === true) return;
    if (exercise.settings.instant) {
      setPicked(optionId);
      send(optionId);
      return;
    }
    // Re-picking a judged-but-open question drops the judgement and re-arms `Sjekk`. The
    // try is not spent by that — only `Prøv igjen` spends one.
    if (phase === 'judged') {
      setResult(null);
      setPhase('picking');
    }
    setPicked(optionId);
  };

  const retry = () => {
    setResult(null);
    setPicked(null);
    setAttempt(attempt + 1);
    setPhase('picking');
  };

  const next = () => {
    setResult(null);
    setPicked(null);
    setAttempt(1);
    setEliminated([]);
    if (index + 1 < projection.questions.length) {
      setIndex(index + 1);
      setPhase('picking');
      return;
    }
    setPhase('done');
  };

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setResult(null);
    setAttempt(1);
    setEliminated([]);
    setScore(0);
    setPhase('picking');
  };

  // Every hook has run by here. The empty state is a render, never an early return — a set
  // with nothing finished in it is the normal state of a half-written exercise.
  if (question === undefined) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        {t('multipleChoice.preview.empty')}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <MultipleChoiceBody
        set={projection}
        index={index}
        picked={picked}
        onPick={pick}
        phase={phase}
        result={result}
        attempt={attempt}
        eliminated={eliminated}
        score={score}
        interactive
        onCheck={() => send(picked)}
        onRetry={retry}
        onReveal={() => send(null, true)}
        onNext={next}
        onRestart={restart}
        accent={PRACTICE_ACCENT}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{t('multipleChoice.preview.live')}</p>
        {exercise.settings.shuffle && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setSeed(seed + 1)}>
            <ShuffleIcon className="size-3.5" aria-hidden />
            {t('multipleChoice.preview.reshuffle')}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * A deterministic shuffle for one render of the panel.
 *
 * The kernel takes the randomness as a parameter precisely so the engine can seed it per
 * attempt and this panel can hold it still between keystrokes. Quality is irrelevant here
 * — it deals options a teacher looks at — and repeatability is the whole requirement.
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
