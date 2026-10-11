'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  formatFields,
  isLexicalType,
  issues,
  packOf,
  placedAudioIssues,
  readyFields,
  skillOf,
  stepState,
  type Issue,
  type IssueStep,
} from '@/lib/shared-kernel/information-transfer';
import type { PlacedAudioIssue } from '@/lib/shared-kernel/audio';

import { useExerciseTargets } from '../../api/use-exercise-targets';
import { foldAudioIntoStep, useAudioGateRows } from '../audio';
import { BuilderGateDialog, BuilderSaveHint, BuilderStepNav, type GateRow } from '../builder-frame';
import { BuilderConflictDialog, useBuilderSaveNotices } from '../builder-save-notices';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { EditorToolbarPortal } from '../editor-toolbar';
import { MONO } from '../minimal-pairs/parts';
import type { InformationTransferDocument } from './edits';
import { useIssueCopy } from './issue-copy';
import { StepAnswers } from './step-answers';
import { StepDelivery } from './step-delivery';
import { StepForm } from './step-form';
import { StepResult } from './step-result';
import { StepSource } from './step-source';
import {
  sameDocument,
  useInformationTransferAutosave,
  type SavedDocument,
} from './use-information-transfer-autosave';

const STEPS: IssueStep[] = [1, 2, 3, 4, 5];
const LAST_STEP = 5;

export interface InformationTransferBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, both columns joined. */
  initialExercise: InformationTransferDocument;
  onDocumentChange?: (exercise: InformationTransferDocument) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The `information_transfer` builder: five steps — source, blank, answers, delivery, result
 * (plan 73 §7.1).
 *
 * The rail is not a wizard and nothing is gated until the gate. Every dot is the kernel's
 * `stepState` with the audio layer folded in, and the signals inside the steps and the gate
 * are the same issue list read three ways — the list the server's publish preflight runs, so
 * the gate cannot promise what publication refuses (INF-B27, B28, B30). Saved as the author
 * works.
 */
export function InformationTransferBuilder({
  exerciseId,
  containerId,
  initialExercise,
  onDocumentChange,
  onSavedRemote,
}: InformationTransferBuilderProps) {
  const t = useTranslations('Authoring');
  const names = useStepNames();
  const [exercise, setExercise] = useState(initialExercise);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  /** The document as this page found it — the undo autosave would otherwise take away. */
  const [opened] = useState(initialExercise);

  const autosave = useInformationTransferAutosave({
    exerciseId,
    containerId,
    exercise,
    onSaved: (updatedAt, saved) => {
      setExercise((current) => ({ ...current, updatedAt }));
      onSavedRemote?.(updatedAt, saved);
    },
  });

  const problems = useMemo(() => issues(exercise), [exercise]);
  const audioProblems = useMemo(() => placedAudioIssues(exercise), [exercise]);
  const wordAtoms = useLexicalWordAtoms(exerciseId, exercise);
  const changedSinceOpen = !sameDocument(exercise, opened);

  const revert = () => {
    // The token of the row as it stands, on the document as it was: the write has to land on the
    // version autosave last wrote, or it would be refused as somebody else's.
    setExercise({ ...opened, updatedAt: exercise.updatedAt });
    setRevertOpen(false);
  };

  useBuilderSaveNotices({
    status: autosave.status,
    rejection: autosave.rejection,
    failures: autosave.failures,
    onRetry: autosave.retry,
  });

  const reportRef = useRef(onDocumentChange);
  useEffect(() => {
    reportRef.current = onDocumentChange;
  });
  useEffect(() => {
    reportRef.current?.(exercise);
  }, [exercise]);

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex min-w-0 flex-1 items-stretch justify-between gap-3">
          <InformationTransferSteps
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
        {step === 1 && <StepSource exercise={exercise} onChange={setExercise} />}
        {step === 2 && <StepForm exercise={exercise} onChange={setExercise} />}
        {step === 3 && <StepAnswers exercise={exercise} onChange={setExercise} />}
        {step === 4 && <StepDelivery exercise={exercise} onChange={setExercise} />}
        {step === 5 && (
          <StepResult exercise={exercise} onChange={setExercise} wordAtoms={wordAtoms} />
        )}

        <BuilderStepNav
          current={step}
          last={LAST_STEP}
          stepLabel={(n) => names.label(n as IssueStep)}
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

      <BuilderConflictDialog
        open={autosave.status === 'conflict'}
        onOverwrite={autosave.overwrite}
        onDiscard={() => window.location.reload()}
      />
    </div>
  );
}

/**
 * The lemmas of the word atoms the lexical cells are addressed to — what the second atom card
 * of step 5 names. Read from the exercise's own targets (the shared panel writes them); a cell
 * of time or money can carry no word atom (DECISIONS §4), so only `word`/`name` cells count.
 */
function useLexicalWordAtoms(exerciseId: string, exercise: InformationTransferDocument): string[] {
  const targets = useExerciseTargets(exerciseId);
  const lexical = new Set(exercise.fields.filter((f) => isLexicalType(f.type)).map((f) => f.id));
  const lemmas = (targets.data?.items ?? [])
    .filter((item) => item.itemKey !== null && lexical.has(item.itemKey))
    .flatMap((item) => item.targets)
    .filter((target) => target.atomType === 'vocabulary_item' && target.atomTitle !== null)
    .map((target) => target.atomTitle as string);
  return [...new Set(lemmas)];
}

/** The five steps' names and sub-lines, spelled out — no key is built from the number. */
function useStepNames() {
  const t = useTranslations('Authoring.informationTransfer.shell');
  const label = (step: IssueStep) =>
    step === 1
      ? t('step1')
      : step === 2
        ? t('step2')
        : step === 3
          ? t('step3')
          : step === 4
            ? t('step4')
            : t('step5');
  const sub = (step: IssueStep) =>
    step === 1
      ? t('stepSub1')
      : step === 2
        ? t('stepSub2')
        : step === 3
          ? t('stepSub3')
          : step === 4
            ? t('stepSub4')
            : t('stepSub5');
  return { label, sub, stepsLabel: t('stepsLabel') };
}

/** The rail: `Source · text or recording`, `Blank · the fields`, … with the kernel's dot per step. */
function InformationTransferSteps({
  current,
  exercise,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  exercise: InformationTransferDocument;
  audioProblems: PlacedAudioIssue[];
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');
  const names = useStepNames();

  const steps: BuilderStep[] = STEPS.map((step) => {
    const state = foldAudioIntoStep(
      stepState(exercise, step),
      audioProblems.filter((issue) => issue.step === step),
    );
    const label = names.label(step);
    const sub = names.sub(step);

    if (state.s === 'err') {
      return {
        n: step,
        label,
        sub,
        status: 'blockers',
        blockers: state.errs,
        statusLabel: t('builder.blockerCount', { count: state.errs }),
      };
    }
    if (state.s === 'warn') {
      return { n: step, label, sub, status: 'warn', statusLabel: t('builder.warningCount') };
    }
    if (state.s === 'empty') {
      return { n: step, label, sub, status: 'empty', statusLabel: t('builder.stepEmpty') };
    }
    return { n: step, label, sub, status: 'ok', statusLabel: t('builder.stepOk') };
  });

  return (
    <BuilderStepRail
      steps={steps}
      current={current}
      onSelect={(step) => onSelect(step as IssueStep)}
      label={names.stepsLabel}
    />
  );
}

/**
 * The gate (plan 73 §7.7): blockers, then warnings — the audio layer's beside the type's own —
 * each with the prototype's fix label and a way to its step; then the kernel's notes, what
 * already passes, and the two closing paragraphs. A filter over `issues` and nothing more
 * (INF-B28). The axes are the shared card under the builder, not repeated here (deviation 9).
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
  exercise: InformationTransferDocument;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: number) => void;
}) {
  const t = useTranslations('Authoring.informationTransfer.gate');
  const copy = useIssueCopy();
  const audioRows = useAudioGateRows(audioProblems);

  const row = (issue: Issue, index: number): GateRow => ({
    key: `${issue.level}-${issue.code}-${index}`,
    level: issue.level === 'blocker' ? 'blocker' : 'warning',
    text: copy.describe(issue),
    step: issue.step,
    action: copy.fix(issue),
  });

  const rows: GateRow[] = [
    ...audioRows.filter((r) => r.level === 'blocker'),
    ...problems.filter((issue) => issue.level === 'blocker').map(row),
    ...audioRows.filter((r) => r.level === 'warning'),
    ...problems.filter((issue) => issue.level === 'warning').map(row),
  ];
  const infos = problems.filter((issue) => issue.level === 'info').map((i) => copy.describe(i));
  const mono = (chunks: ReactNode) => <span style={MONO}>{chunks}</span>;

  return (
    <BuilderGateDialog
      open={open}
      rows={rows}
      infos={infos}
      passes={usePasses(exercise)}
      notes={[t('evidence'), t.rich('notFreeForm', { mono })]}
      onOpenChange={onOpenChange}
      onGoToStep={onGoToStep}
    />
  );
}

/** The prototype's «what already passes» lines (`AssignGate`), from the author's own settings. */
function usePasses(exercise: InformationTransferDocument): string[] {
  const t = useTranslations('Authoring.informationTransfer.gate');
  const ready = readyFields(exercise).length;
  const formats = formatFields(exercise).length;
  const pack = packOf(exercise);
  const { audio, scoring, grading, answering } = exercise;
  const skill = `skill:${skillOf(exercise)}`;

  const source =
    exercise.sourceKind === 'audio'
      ? t('audioSource', {
          plays:
            audio.settings.plays === 0
              ? t('freePlay')
              : t('playbacks', { count: audio.settings.plays }),
          fragments: audio.useSegments ? t('fragments') : '',
        })
      : answering.showSource === 'always'
        ? t('textSource')
        : null;

  const memory =
    scoring.memory === 'none'
      ? t('memoryNone')
      : t('memory', {
          skill,
          words: scoring.memory === 'skill+words' ? t('memoryWords') : '',
          exposure: scoring.logWordExposure ? t('memoryExposure') : '',
        });

  return [
    ready > 0 ? t('cells', { count: ready }) : null,
    t('graded', { pass: scoring.passPct, required: grading.requiredAll ? t('requiredAll') : '' }),
    formats > 0
      ? pack === undefined
        ? t('formatsDigits', { count: formats })
        : t('formats', {
            count: formats,
            spelled: grading.spelledNumbers ? t('spelled') : '',
            pack: pack.label,
          })
      : null,
    source,
    memory,
    ready > 0 ? t('addressing') : null,
  ].filter((line): line is string => line !== null);
}
