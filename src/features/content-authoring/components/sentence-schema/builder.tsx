'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Undo2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  issues,
  passes,
  stepState,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/sentence-schema';

import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import type { AudioStepMap, PlacedAudioIssue } from '@/lib/shared-kernel/audio';

import { useAudioGateRows, useAudioProblems } from '../audio';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepSchema } from './step-schema';
import { StepSentences } from './step-sentences';
import { StepDifficulty } from './step-difficulty';
import { StepFeedback } from './step-feedback';
import type { SentenceSchemaDocument } from './edits';
import {
  sameDocument,
  useSentenceSchemaAutosave,
  type SavedDocument,
} from './use-sentence-schema-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3, 4];

/**
 * Where this builder keeps each part of the audio layer.
 *
 * Step 1 is the board — the schema every sentence is measured against — and step 2 is the
 * sentences themselves, so both the clip and the timecodes belong to step 2. The rules go
 * with the difficulty on step 3 and the transcript with the feedback on step 4.
 */
const AUDIO_STEPS: AudioStepMap = { source: 2, segments: 2, rules: 3, transcript: 4 };
const LAST_STEP = 4;

export interface SentenceSchemaBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The course's language, as an ISO 639-1 code. Decides which packs step 1 offers. */
  targetLanguage: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: SentenceSchemaDocument;
  onDocumentChange?: (exercise: SentenceSchemaDocument) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The sentence-schema builder: four steps, one document, a rail that says where the
 * problems are, and a save the teacher never has to think about.
 *
 * The rail is not a wizard, and for this type least of all. The schema on step 1 decides
 * what the placements on step 2 can even mean, and writing the sentences is what shows the
 * author that their schema is missing a field — so the loop between the two *is* the
 * authoring, and both directions have to be one click. Steps 3 and 4 are read from the
 * finished set and can be answered in any order.
 *
 * Everything derived comes from the kernel: the rail dots, the inline problems on each
 * step and the gate are one issue list filtered three ways. That is the handoff's second
 * pitfall taken literally — a second opinion about the same document drifts within a week,
 * and the drift is invisible, because neither side is obviously the liar.
 */
export function SentenceSchemaBuilder({
  exerciseId,
  containerId,
  targetLanguage,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: SentenceSchemaBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  /*
    Step 2 first. Every other builder opens on step 1, and this one does not: step 1 is
    seeded with a working schema by the scaffold, while step 2 opens on a blank card that
    is the only thing standing between this exercise and a student. Sending the author to
    the pack grid would have them choosing between four Norwegian charts before writing a
    word — and the handoff's own build order puts the sentences first for the same reason.
  */
  const [step, setStep] = useState<IssueStep>(2);
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);

  /**
   * The document as this page found it.
   *
   * A save the author never presses is the right default — the six builders before this
   * one work the same way, and an exercise waits in its draft until the module is
   * published, so nothing typed here reaches a student either way. What that costs is the
   * oldest undo there is: reloading no longer brings back what was there before, because
   * autosave has already written it. This is what gives that back — state set once and
   * never again, so it stays put while the document moves under it.
   */
  const [opened] = useState(initialExercise);

  const autosave = useSentenceSchemaAutosave({
    exerciseId,
    containerId,
    exercise,
    onSaved: (updatedAt, saved) => {
      setExercise((current) => ({ ...current, updatedAt }));
      onSavedRemote?.(updatedAt, saved);
    },
  });

  const reportRef = useRef(onDocumentChange);
  useEffect(() => {
    reportRef.current = onDocumentChange;
  });
  useEffect(() => {
    reportRef.current?.(exercise);
  }, [exercise]);

  const problems = useMemo(() => issues(exercise), [exercise]);

  /** The layer's findings, in the same rail and the same gate as the type's own. */
  const audioProblems = useAudioProblems(
    exercise.audio,
    exercise.rows.map((row) => row.id),
    AUDIO_STEPS,
  );

  const changedSinceOpen = !sameDocument(exercise, opened);

  const revert = () => {
    // The token of the row as it stands, on the document as it was: the write has to land
    // on the version autosave last wrote, or it would be refused as somebody else's.
    setExercise({ ...opened, updatedAt: exercise.updatedAt });
    setRevertOpen(false);
  };

  useBuilderSaveNotices({
    status: autosave.status,
    rejection: autosave.rejection,
    failures: autosave.failures,
    onRetry: autosave.retry,
  });

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex min-w-0 flex-1 items-stretch justify-between gap-3">
          <SentenceSchemaSteps
            current={step}
            exercise={exercise}
            audioProblems={audioProblems}
            onSelect={setStep}
          />
          <div className="flex shrink-0 items-center gap-3 py-2">
            <BuilderSaveHint status={autosave.status} savedAt={autosave.savedAt} />
          </div>
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 1 && (
          <StepSchema exercise={exercise} targetLanguage={targetLanguage} onChange={setExercise} />
        )}
        {step === 2 && (
          <StepSentences
            exercise={exercise}
            onChange={setExercise}
            onGoToStep={(target) => setStep(target as IssueStep)}
          />
        )}
        {step === 3 && <StepDifficulty exercise={exercise} onChange={setExercise} />}
        {step === 4 && <StepFeedback exercise={exercise} onChange={setExercise} />}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) => t(`sentenceSchema.shell.step${n}` as 'sentenceSchema.shell.step1')}
          onSelect={(next) => setStep(next as IssueStep)}
          onDone={() => setGateOpen(true)}
        />
      </div>

      <GateDialog
        open={gateOpen}
        exercise={exercise}
        problems={problems}
        audioProblems={audioProblems}
        onOpenChange={setGateOpen}
        onGoToStep={(target) => {
          setStep(target as IssueStep);
          setGateOpen(false);
        }}
      />

      {/*
        Rare, and it throws away everything typed since the page opened — so it is a plain
        link rather than a button competing with the way forward, and it asks first. Hidden
        while there is nothing to undo.
      */}
      {changedSinceOpen && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setRevertOpen(true)}
          >
            <Undo2 className="size-3.5" aria-hidden />
            {t('builder.revert')}
          </Button>
        </div>
      )}

      <AlertDialog open={revertOpen} onOpenChange={setRevertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('builder.revertTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('builder.revertBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('builder.revertCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={revert}>{t('builder.revertConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/*
        The one save state that is a question rather than a report. Reading the other
        version means leaving this one, so it is a reload and not a silent swap: the
        author's unsaved work is on screen, and nothing may take it away without saying so.
      */}
      <BuilderConflictDialog
        open={autosave.status === 'conflict'}
        onOverwrite={autosave.overwrite}
        onDiscard={() => window.location.reload()}
      />
    </div>
  );
}

/**
 * Where the problems are, per step, in the rail every builder shares.
 *
 * The state of a step is the kernel's answer, not this component's: `stepState` is what
 * the server's publish preflight reads too, and a rail that worked it out for itself would
 * be a second opinion about the same document.
 */
function SentenceSchemaSteps({
  current,
  exercise,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: SentenceSchemaDocument;
  audioProblems: PlacedAudioIssue[];
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = STEPS.map((step) => {
    // Both lists at once: a step is as bad as its worst finding, whichever list it came
    // from. `stepState` here counts errors and warnings, so the fold is written in its
    // shape rather than in the shared one.
    const own = stepState(exercise, step);
    const here = audioProblems.filter((issue) => issue.step === step && issue.level !== 'info');
    const audioErrors = here.filter((issue) => issue.level === 'blocker').length;
    const state = {
      state:
        audioErrors > 0
          ? ('err' as const)
          : here.length > 0 && own.state !== 'err'
            ? ('warn' as const)
            : own.state,
      errors: own.errors + audioErrors,
      warnings: own.warnings + here.length - audioErrors,
    };
    const label = t(`sentenceSchema.shell.step${step}` as 'sentenceSchema.shell.step1');
    const sub = t(`sentenceSchema.shell.stepSub${step}` as 'sentenceSchema.shell.stepSub1');

    if (state.state === 'err') {
      return {
        n: step,
        label,
        sub,
        status: 'blockers',
        blockers: state.errors,
        statusLabel: t('builder.blockerCount', { count: state.errors }),
      };
    }
    if (state.state === 'warn') {
      return { n: step, label, sub, status: 'warn', statusLabel: t('builder.warningCount') };
    }
    // `empty` is in the kernel's type because the handoff names it, and this engine never
    // returns it. Drawn anyway rather than asserted away: a rail that threw on it would
    // turn a change in the rules into a crash.
    if (state.state === 'empty') {
      return { n: step, label, sub, status: 'empty', statusLabel: t('builder.stepEmpty') };
    }
    return { n: step, label, sub, status: 'ok', statusLabel: t('builder.stepOk') };
  });

  return (
    <BuilderStepRail
      steps={steps}
      current={current}
      onSelect={(step) => onSelect(step as IssueStep)}
      label={t('sentenceSchema.shell.stepsLabel')}
    />
  );
}

/**
 * The gate, filled from the kernel's issue list.
 *
 * A filter over `issues` and nothing more — no rule of its own, which is what makes the
 * modal, the rail and the step-level messages incapable of disagreeing. `info` issues
 * would be left out here; this type's engine raises none, and the filter stays anyway so
 * that adding one later cannot quietly put an observation on a list of things to fix.
 */
function GateDialog({
  open,
  exercise,
  problems,
  audioProblems,
  onOpenChange,
  onGoToStep,
}: {
  open: boolean;
  exercise: SentenceSchemaDocument;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: number) => void;
}) {
  const describeIssue = useIssueCopy(exercise);
  const audioRows = useAudioGateRows(audioProblems);

  const rows: GateRow[] = [
    ...audioRows,
    ...problems
      .filter((issue) => issue.level === 'blocker')
      .map((issue, index) => ({
        key: `blocker-${issue.code}-${index}`,
        level: 'blocker' as const,
        text: describeIssue(issue),
        step: issue.step,
      })),
    ...problems
      .filter((issue) => issue.level === 'warning')
      .map((issue, index) => ({
        key: `warning-${issue.code}-${index}`,
        level: 'warning' as const,
        text: describeIssue(issue),
        step: issue.step,
      })),
  ];

  return (
    <BuilderGateDialog
      open={open}
      rows={rows}
      passes={usePasses(exercise)}
      onOpenChange={onOpenChange}
      onGoToStep={onGoToStep}
    />
  );
}

/**
 * What this exercise is about to do to a student, in the author's own numbers.
 *
 * Everything here is restated from what they already wrote, which is the point: they wrote
 * it one step at a time, and this is the only place it is read together. The line that
 * carries most is the third — a chunk accepted in more than one field is the one claim in
 * the document that cannot be seen from the board, and an author who meant to allow
 * adverbial fronting and forgot will read a zero here.
 */
function usePasses(exercise: SentenceSchemaDocument): string[] {
  const t = useTranslations('Authoring');
  const summary = passes(exercise);

  return [
    t('sentenceSchema.gate.sentences', { count: summary.deliverableRows }),
    summary.clausesCovered.length > 0
      ? t('sentenceSchema.gate.clauses', {
          clauses: summary.clausesCovered
            .map((clause) => t(`sentenceSchema.clause.${clause}` as 'sentenceSchema.clause.main'))
            .join(' · '),
        })
      : null,
    summary.rowsWithAlternatives > 0
      ? t('sentenceSchema.gate.alternatives', { count: summary.rowsWithAlternatives })
      : null,
    summary.chunkNotes > 0 ? t('sentenceSchema.gate.notes', { count: summary.chunkNotes }) : null,
    exercise.settings.order === 'strict'
      ? t('sentenceSchema.gate.orderStrict')
      : t('sentenceSchema.gate.orderLoose'),
  ].filter((line): line is string => line !== null);
}
