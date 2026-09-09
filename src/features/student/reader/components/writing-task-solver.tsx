'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  fetchDraft,
  fetchLastAttempt,
  resolveSubmitFailure,
  useSaveDraft,
  useStartAttempt,
  useSubmitAnswer,
  type SubmitFailureResolution,
} from '@/features/student/exercises/api/use-attempt';
import type { AttemptRecord } from '@/features/student/exercises/types/attempts';
import {
  GRADED_ACCENT,
  readWritingTaskProjection,
  submitGate,
  WritingTaskBody,
  WritingTaskGraded,
  type DraftSaveState,
  type WritingTaskPhase,
  type WritingTaskValue,
} from '@/features/student/exercises/runner';
import type { StudentProjection } from '@/lib/shared-kernel/writing-task';
import { useExerciseAudio } from '@/features/student/exercises/audio';
import { ErrorState, LearningSkeleton } from '@/features/learning';

export interface WritingTaskSolverProps {
  exerciseId: string;
  /** Instruction text in the learner's language, from the exercise's instructions. */
  instruction?: string;
  /** Language of the instructions, sent when the attempt starts. */
  language: string;
  /** Fired once, on the first submission. Always `null` — nothing here is auto-judged. */
  onChecked?: (ok: boolean | null) => void;
}

/** How long the text may sit unchanged before it is saved. */
const AUTOSAVE_QUIET_MS = 1200;

/**
 * `writing_task` played against the server.
 *
 * The template with no auto-check by construction: there is no key to compare a whole
 * text against, so every submission goes to a teacher and this screen never says whether
 * the work was right. What it does own is the writing itself — which makes losing it the
 * worst failure available here, and why the draft is saved on the server rather than in
 * this browser (`useSaveDraft`).
 *
 * The state machine is the handoff's, minus the stage that does not exist:
 *
 *     draft ──Lever til læreren──▶ sent ──teacher grades──▶ graded
 *
 * `graded` is reached by coming back, not by waiting here: the teacher's verdict arrives
 * hours later, through the queue and the notification that follows it.
 */
export function WritingTaskSolver({
  exerciseId,
  instruction,
  language,
  onChecked,
}: WritingTaskSolverProps) {
  const t = useTranslations('ExerciseRunner');

  const start = useStartAttempt(exerciseId);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [projection, setProjection] = useState<StudentProjection | null>(null);
  /**
   * The document as the engine dealt it, kept for the audio layer alone: the projection is
   * the kernel's own shape and has no room for a block that is not the template's.
   *
   * No transcript state here, and none is owed: a clip on this template is a stimulus, and
   * what it says is not an answer being withheld.
   */
  const [document, setDocument] = useState<unknown>(null);
  const audio = useExerciseAudio(document);
  /** Set when the task arrived with its answer key still on it — see the reader. */
  const [unusable, setUnusable] = useState(false);

  const submit = useSubmitAnswer(exerciseId, attemptId);
  const saveDraft = useSaveDraft(exerciseId, attemptId);

  const [value, setValue] = useState<WritingTaskValue>({ text: '', ticked: [] });
  const [phase, setPhase] = useState<WritingTaskPhase>('draft');
  const [attemptNo, setAttemptNo] = useState(1);
  const [saveState, setSaveState] = useState<DraftSaveState>('idle');
  /** The verdict the learner came back to, when there is one. */
  const [verdict, setVerdict] = useState<AttemptRecord | null>(null);
  const [sendFailure, setSendFailure] = useState<SubmitFailureResolution | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  /** Wall-clock since the attempt opened; the engine records it per submission. */
  const openedAt = useRef(0);
  /** The saved text gets one chance to appear, when the task arrives. */
  const restoreConsidered = useRef(false);

  const startMutate = start.mutate;
  const begin = useCallback(() => {
    startMutate(
      { language },
      {
        onSuccess: async (data) => {
          const task = readWritingTaskProjection(data.exerciseContent);
          if (task === null) {
            setUnusable(true);
            return;
          }

          setAttemptId(data.attemptId);
          setProjection(task);
          setDocument(data.exerciseContent);
          openedAt.current = Date.now();

          if (restoreConsidered.current) return;
          restoreConsidered.current = true;

          // Two pasts to look at, and they answer different questions. The draft is
          // unfinished writing on the attempt that is open now — it carries over even
          // when re-opening the page restarted the attempt (the start route moves it).
          // The last finished attempt is work already handed in, and it outranks a
          // draft: a learner who submitted and came back must not be shown an editable
          // field with an older version of the text they already sent.
          const [draft, last] = await Promise.all([
            fetchDraft(exerciseId, data.attemptId),
            fetchLastAttempt(exerciseId),
          ]);

          if (last !== null && last.templateCode === 'writing_task') {
            const submitted = readSubmitted(last.submittedAnswer);
            if (submitted !== null) {
              setValue(submitted);
              setVerdict(last);
              setPhase(last.status === 'ROUTED_FOR_REVIEW' ? 'sent' : 'graded');
              return;
            }
          }

          const saved = readSubmitted(draft?.draftAnswer);
          if (saved !== null) {
            setValue(saved);
            if (draft?.draftSavedAt != null) setSaveState('saved');
          }
        },
      },
    );
  }, [startMutate, language, exerciseId]);

  useEffect(() => {
    begin();
  }, [begin]);

  const retry = useCallback(() => {
    setUnusable(false);
    begin();
  }, [begin]);

  /**
   * Autosave: after the typing stops, and only while there is an attempt to save into.
   *
   * Debounced rather than per keystroke — a request per character would be a request per
   * character — and deliberately not on an interval either: a learner who stops writing
   * mid-sentence and closes the tab is exactly the case this exists for, and an interval
   * would leave up to its own length of that sentence unsaved.
   */
  const autosaveOn = projection?.settings.autosave ?? false;
  const saveDraftMutate = saveDraft.mutate;
  useEffect(() => {
    if (!autosaveOn || phase !== 'draft' || attemptId === null) return;
    if (value.text === '' && value.ticked.length === 0) return;

    const id = setTimeout(() => {
      saveDraftMutate(
        {
          draftAnswer: {
            text: value.text,
            ticked: value.ticked,
            elapsedSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
          },
        },
        {
          onSuccess: () => setSaveState('saved'),
          // Deliberately quiet. The learner can see their own text on the screen; a red
          // line about a failed background save would tell them something is wrong with
          // work that is, at this moment, perfectly safe in front of them. The next
          // keystroke tries again.
          onError: () => setSaveState('idle'),
        },
      );
    }, AUTOSAVE_QUIET_MS);
    return () => clearTimeout(id);
  }, [value, autosaveOn, phase, attemptId, saveDraftMutate]);

  if (!unusable && (start.isPending || (start.isSuccess && projection === null))) {
    return <LearningSkeleton variant="list" rows={4} />;
  }
  if (unusable || start.isError || projection === null || attemptId === null) {
    return <ErrorState onRetry={retry} />;
  }

  const gate = submitGate(projection, value.text);
  // The reader owns the instruction line — it is translated per learner, while the
  // projection carries the author's own. One or the other, never both on the screen.
  const task =
    instruction === undefined || instruction === '' ? projection : { ...projection, instruction };

  function send() {
    if (projection === null) return;
    setSendFailure(null);
    submit.mutate(
      {
        submittedAnswer: { text: value.text, ticked: value.ticked },
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - openedAt.current) / 1000)),
      },
      {
        onSuccess: () => {
          setPhase('sent');
          setSaveState('idle');
          // Always `null`: a written text is never judged by the machine, and reporting
          // anything else would put a verdict on the reader's card that no one gave.
          onChecked?.(null);
        },
        onError: async () => {
          if (attemptId === null) return;
          setConfirmingDelivery(true);
          const resolution = await resolveSubmitFailure(exerciseId, attemptId);
          setConfirmingDelivery(false);
          if (resolution === 'delivered') {
            setPhase('sent');
            onChecked?.(null);
          } else {
            setSendFailure(resolution);
          }
        },
      },
    );
  }

  const note =
    gate.block === 'short'
      ? t('writingTask.needMore', {
          min: projection.settings.minWords,
          left: gate.remaining,
        })
      : gate.block === 'long'
        ? t('writingTask.tooLong', { max: projection.settings.maxWords })
        : t('writingTask.readByTeacher');

  /**
   * Every edit, and the "saving" line that goes with it.
   *
   * The line is set here rather than in the autosave effect: an effect that flips it on
   * every keystroke is a cascading render, and this is the honest place anyway — the
   * learner typed, so from their point of view there is now something unsaved.
   */
  function changeValue(next: WritingTaskValue) {
    setValue(next);
    if (autosaveOn && phase === 'draft') setSaveState('saving');
  }

  /**
   * Back to a blank draft for another try.
   *
   * A new attempt, not an edit of the old one: the submitted text is what the teacher
   * read and commented on, and it stays as it was. `begin` starts that attempt, and the
   * restore inside it is skipped — `restoreConsidered` has already fired, which is what
   * keeps the finished attempt from pulling the learner straight back into `graded`.
   */
  function rewrite() {
    setValue({ text: '', ticked: [] });
    setPhase('draft');
    setAttemptNo((n) => n + 1);
    setVerdict(null);
    setSaveState('idle');
    setSendFailure(null);
    begin();
  }

  return (
    <div>
      <WritingTaskBody
        task={task}
        audio={audio}
        value={value}
        onValueChange={changeValue}
        phase={phase}
        attemptNo={attemptNo}
        saveState={saveState}
        accent={GRADED_ACCENT}
      />

      {phase === 'draft' ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!gate.canSubmit || submit.isPending || confirmingDelivery}
            onClick={send}
            className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
            style={{ background: GRADED_ACCENT }}
          >
            {submit.isPending || confirmingDelivery
              ? t('writingTask.sending')
              : t('writingTask.send')}
          </button>
          <span className="text-[12.5px] text-(--ssz-text-muted)">{note}</span>

          {/* 47.0.B: what a failed send actually did, resolved against the server first. */}
          {sendFailure === 'not-delivered' && (
            <span className="text-[12.5px] text-(--ssz-feedback-no-fg)">
              {t('writingTask.sendFailedRetry')}
            </span>
          )}
          {sendFailure === 'unconfirmed' && (
            <span className="text-[12.5px] text-(--ssz-feedback-no-fg)">
              {t('writingTask.sendUnconfirmed')}
            </span>
          )}
        </div>
      ) : phase === 'sent' ? (
        <div
          className="mt-4 rounded-2xl border px-4 py-3"
          style={{
            borderColor: 'var(--ssz-border-default)',
            background: 'var(--ssz-bg-surface-subtle)',
          }}
        >
          <p className="text-[14px] font-semibold text-(--ssz-text-primary)">
            {t('writingTask.delivered')}
          </p>
          <p className="mt-1 text-[12.5px] text-(--ssz-text-secondary)">
            {t('writingTask.deliveredWhen')}
          </p>
        </div>
      ) : (
        <WritingTaskGraded
          passed={verdict?.passed ?? null}
          revision={projection.settings.revision}
          showRubric={projection.settings.showRubric}
          snapshot={verdict?.rubricSnapshot ?? null}
          marks={verdict?.rubricMarks ?? null}
          score={verdict?.score ?? null}
          comment={verdict?.reviewComment ?? null}
          onRewrite={rewrite}
          nextAttemptNo={attemptNo + 1}
        />
      )}
    </div>
  );
}

/**
 * A stored answer or draft as this runner can use it.
 *
 * Read rather than trusted: the column holds whatever an older client put there, and a
 * shape that is not this one must cost the restore, not the render. A missing `ticked`
 * is normal — every task with `showPlan: false` submits without one.
 */
function readSubmitted(raw: unknown): WritingTaskValue | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const { text, ticked } = raw as { text?: unknown; ticked?: unknown };
  if (typeof text !== 'string') return null;

  return {
    text,
    ticked: Array.isArray(ticked)
      ? ticked.filter((id): id is string => typeof id === 'string')
      : [],
  };
}
