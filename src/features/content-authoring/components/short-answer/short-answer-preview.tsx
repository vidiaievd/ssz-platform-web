'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  grade,
  gradeableQuestions,
  toContent,
  toExpectedAnswers,
  toStudentProjection,
  toStudentResult,
  type ShortAnswerContent,
  type StudentResult,
} from '@/lib/shared-kernel/short-answer';
import { ShortAnswerBody, type ShortAnswerPhase } from '@/features/student/exercises/runner';
import { PRACTICE_ACCENT } from '@/features/student/exercises/runner/types';

export interface ShortAnswerPreviewProps {
  exercise: ShortAnswerContent;
}

/**
 * The student's view of what the teacher is building — the actual runner body, not a
 * lookalike. IMPLEMENTATION.md is explicit that there is one implementation of the student
 * view and there should not be a second; the first time a copy drifted, the preview would
 * be lying about the product.
 *
 * It goes through `toStudentProjection` rather than handing the document straight over,
 * and that is the point of the panel rather than a detail of it. The projection is what
 * takes the key away — the elements, the anchor phrases, the explanation, and the model
 * answer unless `showModel: 'always'`. An author who wonders whether their students will
 * see the example answer while they write is asking a question only this panel can answer,
 * because the answer is a setting two steps away from where the answer is written.
 *
 * **The verdict is real.** Unlike the writing-task preview, where marking is a person and
 * so a preview cannot show one, this one runs the kernel's own grader — the same `grade`
 * the server calls — and projects its result the same way the server does. That is safe
 * precisely here and nowhere else: the teacher owns the key, so grading in their browser
 * reveals nothing to anybody. It is also the only way the panel answers the question the
 * author actually has, which is whether their key accepts an answer.
 */
export function ShortAnswerPreview({ exercise }: ShortAnswerPreviewProps) {
  const t = useTranslations('Authoring');

  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<ShortAnswerPhase>('writing');
  const [tally, setTally] = useState({ pass: 0, partial: 0, fail: 0 });
  const [result, setResult] = useState<StudentResult | null>(null);

  /**
   * Only the questions that can actually be answered, exactly as the runner sees them.
   *
   * `gradeableQuestions` needs the key, so it runs on the document rather than on the
   * projection — and it is the same filter the server applies before an attempt starts.
   * The projection is then narrowed to match, so the two lists cannot drift apart while
   * the author is halfway through writing question three.
   */
  const ready = useMemo(() => gradeableQuestions(exercise), [exercise]);

  const projection = useMemo(() => {
    const full = toStudentProjection(toContent(exercise), toExpectedAnswers(exercise));
    const answerable = new Set(ready.map((q) => q.id));
    return { ...full, questions: full.questions.filter((q) => answerable.has(q.id)) };
  }, [exercise, ready]);

  /**
   * BEHAVIOR §"Transitions": when the author edits the question set, the runner's index,
   * its done state and its tally reset. Here that is not a nicety — the preview is
   * re-rendered on every keystroke in the editor column, and an index left pointing past
   * the end of a shortened set would put the panel on a question that no longer exists.
   *
   * Adjusted during render rather than in an effect: an effect would paint one frame of
   * the old question against the new set before correcting itself, and that frame is
   * exactly the moment an author's question becomes answerable.
   */
  const count = projection.questions.length;
  const [seenCount, setSeenCount] = useState(count);
  if (seenCount !== count) {
    setSeenCount(count);
    setIndex(0);
    setPhase('writing');
    setValue('');
    setResult(null);
    setTally({ pass: 0, partial: 0, fail: 0 });
  }

  const submit = () => {
    const question = ready[index];
    if (!question) return;
    const outcome = grade(question, value, exercise.settings);
    setResult(
      toStudentResult(
        {
          questionId: question.id,
          verdict: outcome.verdict,
          covered: outcome.covered,
          total: outcome.total,
          tooShort: outcome.tooShort,
          hits: outcome.hits,
          why: question.why,
          model: question.model,
        },
        projection.settings,
      ),
    );
    setTally((current) => ({ ...current, [outcome.verdict]: current[outcome.verdict] + 1 }));
    setPhase('submitted');
  };

  const next = () => {
    if (index + 1 >= count) {
      setPhase('done');
      return;
    }
    setIndex(index + 1);
    setValue('');
    setResult(null);
    setPhase('writing');
  };

  const restart = () => {
    setIndex(0);
    setValue('');
    setResult(null);
    setTally({ pass: 0, partial: 0, fail: 0 });
    setPhase('writing');
  };

  if (count === 0) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        {t('shortAnswer.preview.empty')}
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <ShortAnswerBody
        set={projection}
        index={index}
        value={value}
        onValueChange={setValue}
        phase={phase}
        result={result}
        tally={tally}
        interactive
        onSubmit={submit}
        onNext={next}
        onRestart={restart}
        accent={PRACTICE_ACCENT}
      />
      <p className="text-center text-[11px] text-muted-foreground">
        {t('shortAnswer.preview.live')}
      </p>
    </div>
  );
}
