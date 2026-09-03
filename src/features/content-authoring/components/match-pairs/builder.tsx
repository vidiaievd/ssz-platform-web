'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  issues,
  type Issue,
  type IssueStep,
  type MatchPairs,
  type Variant,
} from '@/lib/shared-kernel/match-pairs';

import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepPairs } from './step-pairs';
import { StepRightColumn } from './step-right-column';
import { StepFeedback } from './step-feedback';
import type { AudioDraft, AudioStepMap, PlacedAudioIssue } from '@/lib/shared-kernel/audio';

import {
  AudioEnableRow,
  AudioRulesCard,
  AudioSourceCard,
  AudioTranscriptCard,
  useAudioIssueCopy,
  useAudioProblems,
} from '../audio';
import { useMatchPairsAutosave, type SavedDocument } from './use-match-pairs-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3];

/**
 * Where this builder keeps each part of the audio layer — three steps, not four.
 *
 * The clip and the timecodes go with the pairs on step 1; the rules and the transcript
 * share step 3. One clip for the exercise with a timecode per pair, which is what the
 * layer can express — audio on *one half* of a pair is a different model and stays out of
 * this plan (§2, "out of bounds").
 */
const AUDIO_STEPS: AudioStepMap = { source: 1, segments: 1, rules: 3, transcript: 3 };

export interface MatchPairsBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, envelope included. */
  initialExercise: MatchPairs;
  /** The listening layer, carried beside the document (plan 56 phase 6). */
  initialAudio: AudioDraft;
  initialInstructions: string;
  /**
   * Whether the stored content named a variant, or is only being read as `pairs` because
   * the field was absent. Computed from the raw column by `hasExplicitVariant`, because
   * the parsed document can no longer tell the two apart.
   */
  initialVariantChosen: boolean;
  onDocumentChange?: (exercise: MatchPairs, instructions: string) => void;
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The match-pairs builder: three steps, one document, a rail that says where the problems
 * are, and a save the teacher never has to think about.
 *
 * The rail is not a wizard. Steps are reachable in any order because authoring is not
 * linear: a pair added in step 1 is a row in step 3 and a chip in step 2, and the teacher
 * will go back.
 *
 * `EX_NO_TITLE` is dropped from every list here, as in the three builders before it: the
 * platform has no title on an exercise — instructions are the required field, enforced on
 * save — and container pre-flight drops the same code for the same reason.
 */
export function MatchPairsBuilder({
  exerciseId,
  containerId,
  initialExercise,
  initialAudio,
  initialInstructions,
  initialVariantChosen,
  onDocumentChange,
  onSavedRemote,
}: MatchPairsBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [audio, setAudio] = useState(initialAudio);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [variantChosen, setVariantChosen] = useState(initialVariantChosen);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);

  const autosave = useMatchPairsAutosave({
    audio,
    exerciseId,
    containerId,
    exercise,
    instructions,
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
    reportRef.current?.(exercise, instructions);
  }, [exercise, instructions]);

  const problems = useMemo(
    () => issues(exercise).filter((issue) => issue.code !== 'EX_NO_TITLE'),
    [exercise],
  );
  /**
   * The one blocker the kernel cannot report. `Variant` has no "unchosen" value and an
   * absent field parses as `pairs`, so "the author never chose" exists only here — and
   * only until the gate is passed once (plan 49, phase 4).
   */
  /** The layer's findings, in the same rail and the same gate as the type's own. */
  const audioProblems = useAudioProblems(
    audio,
    exercise.pairs.map((pair) => pair.id),
    AUDIO_STEPS,
  );

  const blockerCount =
    problems.filter((issue) => issue.level === 'blocker').length +
    audioProblems.filter((issue) => issue.level === 'blocker').length +
    (variantChosen ? 0 : 1);

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex flex-1 items-stretch justify-between gap-3">
          <MatchPairsSteps
            current={step}
            problems={problems}
            audioProblems={audioProblems}
            variantChosen={variantChosen}
            onSelect={setStep}
          />
          <div className="flex shrink-0 items-center gap-3 py-2">
            <SaveHint
              status={autosave.status}
              savedAt={autosave.savedAt}
              canOverwrite={autosave.canOverwrite}
              onRetry={autosave.retry}
              onOverwrite={autosave.overwrite}
            />
            <Button type="button" onClick={() => setGateOpen(true)}>
              {t('matchPairs.shell.done')}
            </Button>
          </div>
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
              <label className="text-xs font-medium" htmlFor="match-pairs-instructions">
                {t('matchPairs.shell.instructionsLabel')}
              </label>
              <Input
                id="match-pairs-instructions"
                value={instructions}
                hasError={instructions.trim() === ''}
                aria-invalid={instructions.trim() === ''}
                placeholder={t('matchPairs.shell.instructionsPlaceholder')}
                onChange={(event) => setInstructions(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('matchPairs.shell.instructionsHelp')}
              </p>
            </div>

            {/* Audio adds no fourth step: it is material, and the material of this
                template is the pairs, which is this step (plan 56). */}
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <AudioEnableRow draft={audio} onChange={setAudio} />
            </div>
            {audio.audio.enabled && <AudioSourceCard draft={audio} onChange={setAudio} />}

            <StepPairs
              exercise={exercise}
              onChange={setExercise}
              audio={audio}
              onAudioChange={setAudio}
              variantChosen={variantChosen}
              onVariantChosen={(variant: Variant) => {
                setVariantChosen(true);
                setExercise((current) => ({ ...current, variant }));
              }}
            />
          </div>
        )}

        {step === 2 && (
          <StepRightColumn
            exercise={exercise}
            onChange={setExercise}
            onEditPairs={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <StepFeedback exercise={exercise} onChange={setExercise} />

            {audio.audio.enabled && (
              <>
                <AudioRulesCard
                  draft={audio}
                  onChange={setAudio}
                  itemNoun={t('matchPairs.audioItemNoun')}
                />
                <AudioTranscriptCard draft={audio} onChange={setAudio} />
              </>
            )}
          </div>
        )}

        <StepNav current={step} onSelect={setStep} onDone={() => setGateOpen(true)} />
      </div>

      <GateDialog
        open={gateOpen}
        problems={problems}
        audioProblems={audioProblems}
        variantChosen={variantChosen}
        blockerCount={blockerCount}
        onOpenChange={setGateOpen}
        onGoToStep={(target) => {
          setStep(target);
          setGateOpen(false);
        }}
      />
    </div>
  );
}

/**
 * Where the problems are, per step, in the rail every builder shares. `variantChosen`
 * is the one blocker the kernel cannot report — `Variant` has no "unchosen" value, so
 * "the author never chose" exists only here (plan 49, phase 4).
 */
function MatchPairsSteps({
  current,
  problems,
  audioProblems,
  variantChosen,
  onSelect,
}: {
  current: IssueStep;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  variantChosen: boolean;
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = STEPS.map((step) => {
    // Both lists at once: a step is as bad as its worst finding, whichever list it came
    // from, and a rail counting only the type's own would show green over an exercise its
    // own publish preflight refuses.
    const own = [
      ...problems.filter((issue) => issue.step === step),
      ...audioProblems.filter((issue) => issue.step === step && issue.level !== 'info'),
    ];
    const blockers =
      own.filter((issue) => issue.level === 'blocker').length +
      (step === 1 && !variantChosen ? 1 : 0);
    const warnings = own.length - own.filter((issue) => issue.level === 'blocker').length;

    return {
      n: step,
      label: t(`matchPairs.shell.step${step}` as 'matchPairs.shell.step1'),
      sub: t(`matchPairs.shell.stepSub${step}` as 'matchPairs.shell.stepSub1'),
      ...(blockers > 0
        ? {
            status: 'blockers' as const,
            blockers,
            statusLabel: t('matchPairs.shell.blockerCount', { count: blockers }),
          }
        : warnings > 0
          ? {
              status: 'warn' as const,
              statusLabel: t('matchPairs.shell.warningCount', { count: warnings }),
            }
          : { status: 'ok' as const, statusLabel: t('matchPairs.shell.stepOk') }),
    };
  });

  return (
    <BuilderStepRail
      steps={steps}
      current={current}
      onSelect={(step) => onSelect(step as IssueStep)}
      label={t('matchPairs.shell.stepsLabel')}
    />
  );
}

interface StepNavProps {
  current: IssueStep;
  onSelect: (step: IssueStep) => void;
  onDone: () => void;
}

/**
 * The way forward at the bottom of a step. The rail above stays the map — this is the
 * default path through it. Nothing here validates: steps are reachable in any order, and
 * the gate is the only place that reports problems.
 */
function StepNav({ current, onSelect, onDone }: StepNavProps) {
  const t = useTranslations('Authoring');
  const previous = (current - 1) as IssueStep;
  const next = (current + 1) as IssueStep;

  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
      <Button
        type="button"
        variant="ghost"
        disabled={current === 1}
        onClick={() => onSelect(previous)}
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t('matchPairs.shell.navBack')}
      </Button>

      {current === 3 ? (
        <Button type="button" onClick={onDone}>
          {t('matchPairs.shell.done')}
        </Button>
      ) : (
        <Button type="button" onClick={() => onSelect(next)}>
          {t('matchPairs.shell.navNext', {
            step: t(`matchPairs.shell.step${next}` as 'matchPairs.shell.step1'),
          })}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

interface SaveHintProps {
  status: ReturnType<typeof useMatchPairsAutosave>['status'];
  savedAt: Date | null;
  canOverwrite: boolean;
  onRetry: () => void;
  onOverwrite: () => void;
}

/**
 * `Saving…` → `Saved`, and a way back when it fails (AC-B23, AC-B24). Announced, never
 * colour alone.
 *
 * A conflict gets its own way out. Autosave stops there by design, so without one the
 * teacher is left with a screen full of work and nothing that will write it.
 */
function SaveHint({ status, savedAt, canOverwrite, onRetry, onOverwrite }: SaveHintProps) {
  const t = useTranslations('Authoring');

  if (status === 'conflict' || status === 'failed') {
    return (
      <span className="flex items-center gap-2 text-xs text-error" role="status">
        <CircleAlert className="size-3.5" aria-hidden />
        {status === 'conflict'
          ? t('matchPairs.shell.saveConflict')
          : t('matchPairs.shell.saveFailed')}
        {status === 'conflict' && canOverwrite ? (
          <Button type="button" variant="link" size="sm" onClick={onOverwrite}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('matchPairs.shell.saveOverwrite')}
          </Button>
        ) : (
          <Button type="button" variant="link" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('matchPairs.shell.saveRetry')}
          </Button>
        )}
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground" aria-live="polite">
      {status === 'saving' && t('matchPairs.shell.saving')}
      {status === 'saved' &&
        savedAt !== null &&
        t('matchPairs.shell.saved', { time: savedAt.toLocaleTimeString() })}
    </span>
  );
}

interface GateDialogProps {
  open: boolean;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  variantChosen: boolean;
  blockerCount: number;
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: IssueStep) => void;
}

/**
 * The pre-assign gate: everything standing between this exercise and a student, blockers
 * first, each row a way to the step that fixes it (AC-B25, AC-B26).
 *
 * A report, not a state change — readiness is decided by container pre-flight from the
 * same rules, so there is nothing here to flip.
 */
function GateDialog({
  open,
  problems,
  audioProblems,
  variantChosen,
  blockerCount,
  onOpenChange,
  onGoToStep,
}: GateDialogProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy();
  const describeAudio = useAudioIssueCopy();

  const rows: { key: string; level: 'blocker' | 'warning'; text: string; step: IssueStep }[] = [
    ...(variantChosen
      ? []
      : [
          {
            key: 'variant',
            level: 'blocker' as const,
            text: t('matchPairs.shell.gateVariant'),
            step: 1 as IssueStep,
          },
        ]),
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
    // The layer's findings, in the same list rather than under a heading of their own: an
    // author who switched listening on has one exercise to finish, not two.
    ...audioProblems
      .filter((issue) => issue.level !== 'info')
      .map((issue, index) => ({
        key: `audio-${issue.code}-${index}`,
        level: issue.level as 'blocker' | 'warning',
        text: describeAudio(issue),
        step: issue.step as IssueStep,
      })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('matchPairs.shell.gateTitle')}</DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <Check className="size-4" aria-hidden />
            {t('matchPairs.shell.gateClear')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rows.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => onGoToStep(row.step)}
                  className="flex w-full items-start gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-[var(--ssz-bg-subtle)]"
                >
                  {row.level === 'blocker' ? (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
                  ) : (
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-warning-700"
                      aria-hidden
                    />
                  )}
                  <span>
                    <span className="block">{row.text}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('matchPairs.shell.gateGoToStep', { step: row.step })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('matchPairs.step1.cancel')}
          </Button>
          <Button type="button" disabled={blockerCount > 0} onClick={() => onOpenChange(false)}>
            {blockerCount > 0
              ? t('matchPairs.shell.gateBlocked', { count: blockerCount })
              : t('matchPairs.shell.gateDone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
