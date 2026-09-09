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
import { Input, Textarea } from '@/components/ui/input';
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
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';

import type { AudioDraft, AudioStepMap, PlacedAudioIssue } from '@/lib/shared-kernel/audio';

import {
  AudioEnableRow,
  AudioRulesCard,
  AudioSourceCard,
  AudioTranscriptCard,
  useAudioIssueCopy,
  useAudioProblems,
} from '../audio';
import { BuilderStepRail, type BuilderStep } from '../builder-step-rail';
import { EditorToolbarPortal } from '../editor-toolbar';
import { StepSentences } from './step-sentences';
import { StepWordBank } from './step-word-bank';
import { StepFeedback } from './step-feedback';
import { useGapFillAutosave, type SavedDocument } from './use-gap-fill-autosave';
import { useIssueCopy } from './issue-copy';

const STEPS: IssueStep[] = [1, 2, 3];

/**
 * Where this builder keeps each part of the audio layer — three steps, not four.
 *
 * The clip and the timecodes go with the sentences on step 1, because a timecode belongs
 * to a sentence. The rules and the transcript are both step 3: that is the step about
 * what the student is told, and when the words of the clip may be read is that same
 * question. Step 2 is the word bank, and nothing about hearing is decided there.
 */
const AUDIO_STEPS: AudioStepMap = { source: 1, segments: 1, rules: 3, transcript: 3 };

export interface GapFillBuilderProps {
  exerciseId: string;
  containerId: string;
  /** The document as loaded from `/exercises/:id/answers`, envelope included. */
  initialExercise: WordBankGapFill;
  initialInstructions: string;
  initialHint: string;
  /**
   * The listening layer as the stored document carries it. A sibling of the instruction
   * and the hint, which is how this builder already holds everything that is not part of
   * the kernel's document (plan 56 phase 5).
   */
  initialAudio: AudioDraft;
  /** Module vocabulary offered as distractors in step 2. */
  suggestions?: string[];
  /**
   * Reports every edit so the shell's preview column can render the student's view of
   * the document being written. Mirrors how the generic exercise form feeds its preview.
   */
  onDocumentChange?: (exercise: WordBankGapFill, instructions: string) => void;
  /**
   * Every successful save, with the token the row now carries. The shell uses it to keep
   * its cached copy of the exercise current: a cache holding a superseded token is a
   * conflict the next time this builder mounts from it.
   */
  onSavedRemote?: (updatedAt: string, saved: SavedDocument) => void;
}

/**
 * The gap-fill builder: three steps, one document, and the two things that make it a
 * screen rather than three forms — a rail that says where the problems are, and a save
 * the teacher never has to think about.
 *
 * The rail is not a wizard. Steps are reachable in any order because authoring is not
 * linear: a gap added in step 1 is a row in step 3, and the teacher will go back.
 *
 * `EX_NO_TITLE` is dropped from every list here. The platform has no title on an
 * exercise — instructions are the required field, enforced on save — and the same code
 * is dropped by container pre-flight for the same reason, so a builder that reported it
 * would be the only place in the product asking for something that cannot be typed.
 */
export function GapFillBuilder({
  exerciseId,
  containerId,
  initialExercise,
  initialInstructions,
  initialHint,
  initialAudio,
  suggestions = [],
  onDocumentChange,
  onSavedRemote,
}: GapFillBuilderProps) {
  const t = useTranslations('Authoring');

  const [exercise, setExercise] = useState(initialExercise);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [hint, setHint] = useState(initialHint);
  const [audio, setAudio] = useState(initialAudio);
  const [step, setStep] = useState<IssueStep>(1);
  const [gateOpen, setGateOpen] = useState(false);

  const autosave = useGapFillAutosave({
    exerciseId,
    containerId,
    exercise,
    instructions,
    hint,
    audio,
    // The token moves on with every save; the next write is compared against this one.
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
  const blockers = problems.filter((issue) => issue.level === 'blocker');

  /** The layer's findings, in the same rail and the same gate as the type's own. */
  const audioProblems = useAudioProblems(
    audio,
    exercise.sentences.map((sentence) => sentence.id),
    AUDIO_STEPS,
  );
  const audioBlockers = audioProblems.filter((issue) => issue.level === 'blocker');

  return (
    <div className="flex flex-col gap-5">
      <EditorToolbarPortal>
        <div className="flex flex-1 items-stretch justify-between gap-3">
          <GapFillSteps
            current={step}
            problems={problems}
            audioProblems={audioProblems}
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
              {t('gapFill.shell.done')}
            </Button>
          </div>
        </div>
      </EditorToolbarPortal>

      <div className="min-w-0">
        <div>
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" htmlFor="gapfill-instructions">
                    {t('gapFill.shell.instructionsLabel')}
                  </label>
                  <Input
                    id="gapfill-instructions"
                    value={instructions}
                    hasError={instructions.trim() === ''}
                    aria-invalid={instructions.trim() === ''}
                    placeholder={t('gapFill.shell.instructionsPlaceholder')}
                    onChange={(event) => setInstructions(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('gapFill.shell.instructionsHelp')}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" htmlFor="gapfill-hint">
                    {t('gapFill.shell.hintLabel')}
                  </label>
                  <Textarea
                    id="gapfill-hint"
                    rows={2}
                    value={hint}
                    placeholder={t('gapFill.shell.hintPlaceholder')}
                    onChange={(event) => setHint(event.target.value)}
                  />
                </div>

                {/* Audio adds no fourth step: it is material, and material lives where the
                    instruction already lives (plan 56, README "Authoring UI"). */}
                <AudioEnableRow draft={audio} onChange={setAudio} />
              </div>

              {audio.audio.enabled && <AudioSourceCard draft={audio} onChange={setAudio} />}

              <StepSentences
                exercise={exercise}
                onChange={setExercise}
                audio={audio}
                onAudioChange={setAudio}
              />
            </div>
          )}

          {step === 2 && (
            <StepWordBank
              exercise={exercise}
              onChange={setExercise}
              suggestions={suggestions}
              onEditGaps={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              <StepFeedback exercise={exercise} onChange={setExercise} />

              {/* Under the feedback rather than above it: the per-gap rows are what this
                  step is for, and the clip's rules are settings about the same screen. */}
              {audio.audio.enabled && (
                <>
                  <AudioRulesCard
                    draft={audio}
                    onChange={setAudio}
                    itemNoun={t('gapFill.step3.audioItemNoun')}
                  />
                  <AudioTranscriptCard draft={audio} onChange={setAudio} />
                </>
              )}
            </div>
          )}
        </div>

        <StepNav current={step} onSelect={setStep} onDone={() => setGateOpen(true)} />
      </div>

      <GateDialog
        open={gateOpen}
        problems={problems}
        audioProblems={audioProblems}
        blockerCount={blockers.length + audioBlockers.length}
        onOpenChange={setGateOpen}
        onGoToStep={(target) => {
          setStep(target);
          setGateOpen(false);
        }}
      />
    </div>
  );
}

/** Where the problems are, per step, in the rail every builder shares. */
function GapFillSteps({
  current,
  problems,
  audioProblems,
  onSelect,
}: {
  current: IssueStep;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  onSelect: (step: IssueStep) => void;
}) {
  const t = useTranslations('Authoring');

  const steps: BuilderStep[] = STEPS.map((step) => {
    // Both lists at once: a step is as bad as its worst finding, whichever list it came
    // from. A rail that counted only the type's own would show green over an exercise its
    // own publish preflight refuses.
    const own = [
      ...problems.filter((issue) => issue.step === step),
      // `info` never reaches the rail from the audio layer for the same reason it never
      // reaches the gate: it changes no answer.
      ...audioProblems.filter((issue) => issue.step === step && issue.level !== 'info'),
    ];
    const blockers = own.filter((issue) => issue.level === 'blocker').length;
    const warnings = own.length - blockers;

    return {
      n: step,
      label: t(`gapFill.shell.step${step}` as 'gapFill.shell.step1'),
      sub: t(`gapFill.shell.stepSub${step}` as 'gapFill.shell.stepSub1'),
      ...(blockers > 0
        ? {
            status: 'blockers' as const,
            blockers,
            statusLabel: t('gapFill.shell.blockerCount', { count: blockers }),
          }
        : warnings > 0
          ? {
              status: 'warn' as const,
              statusLabel: t('gapFill.shell.warningCount', { count: warnings }),
            }
          : { status: 'ok' as const, statusLabel: t('gapFill.shell.stepOk') }),
    };
  });

  return (
    <BuilderStepRail
      steps={steps}
      current={current}
      onSelect={(step) => onSelect(step as IssueStep)}
      label={t('gapFill.shell.stepsLabel')}
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
 * default path through it, so a teacher who has just finished the last sentence does not
 * have to travel back up to the header to carry on. Nothing here validates: steps are
 * reachable in any order, and the gate is the only place that reports problems.
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
        {t('gapFill.shell.navBack')}
      </Button>

      {current === 3 ? (
        <Button type="button" onClick={onDone}>
          {t('gapFill.shell.done')}
        </Button>
      ) : (
        <Button type="button" onClick={() => onSelect(next)}>
          {t('gapFill.shell.navNext', {
            step: t(`gapFill.shell.step${next}` as 'gapFill.shell.step1'),
          })}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

interface SaveHintProps {
  status: ReturnType<typeof useGapFillAutosave>['status'];
  savedAt: Date | null;
  canOverwrite: boolean;
  onRetry: () => void;
  onOverwrite: () => void;
}

/**
 * `Saving…` → `Saved`, and a way back when it fails. Announced, never colour alone.
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
        {status === 'conflict' ? t('gapFill.shell.saveConflict') : t('gapFill.shell.saveFailed')}
        {status === 'conflict' && canOverwrite ? (
          <Button type="button" variant="link" size="sm" onClick={onOverwrite}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('gapFill.shell.saveOverwrite')}
          </Button>
        ) : (
          <Button type="button" variant="link" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('gapFill.shell.saveRetry')}
          </Button>
        )}
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground" aria-live="polite">
      {status === 'saving' && t('gapFill.shell.saving')}
      {status === 'saved' &&
        savedAt !== null &&
        t('gapFill.shell.saved', { time: savedAt.toLocaleTimeString() })}
    </span>
  );
}

interface GateDialogProps {
  open: boolean;
  problems: Issue[];
  audioProblems: PlacedAudioIssue[];
  blockerCount: number;
  onOpenChange: (open: boolean) => void;
  onGoToStep: (step: IssueStep) => void;
}

/** One line of the gate, from either list — they are shown as one. */
interface GateLine {
  key: string;
  level: 'blocker' | 'warning';
  step: IssueStep;
  text: string;
}

/**
 * The pre-assign gate: everything standing between this exercise and a student, blockers
 * first. It is a report, not a state change — readiness is decided by container
 * pre-flight from the same rules, so there is nothing here to flip.
 */
function GateDialog({
  open,
  problems,
  audioProblems,
  blockerCount,
  onOpenChange,
  onGoToStep,
}: GateDialogProps) {
  const t = useTranslations('Authoring');
  const describeIssue = useIssueCopy();
  const describeAudio = useAudioIssueCopy();

  /*
    One list, not two. An author who switched listening on has one exercise to finish, and
    two lists under two headings would let them disagree about whether it is ready.
  */
  const lines: GateLine[] = [
    ...problems.map((issue, index) => ({
      key: `own-${issue.code}-${index}`,
      level: issue.level,
      step: issue.step,
      text: describeIssue(issue),
    })),
    ...audioProblems
      .filter((issue) => issue.level !== 'info')
      .map((issue, index) => ({
        key: `audio-${issue.code}-${index}`,
        level: issue.level as 'blocker' | 'warning',
        step: issue.step as IssueStep,
        text: describeAudio(issue),
      })),
  ];

  const ordered: GateLine[] = [
    ...lines.filter((line) => line.level === 'blocker'),
    ...lines.filter((line) => line.level === 'warning'),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('gapFill.shell.gateTitle')}</DialogTitle>
        </DialogHeader>

        {ordered.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <Check className="size-4" aria-hidden />
            {t('gapFill.shell.gateClear')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {ordered.map((line) => (
              <li key={line.key}>
                <button
                  type="button"
                  onClick={() => onGoToStep(line.step)}
                  className="flex w-full items-start gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-[var(--ssz-bg-subtle)]"
                >
                  {line.level === 'blocker' ? (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
                  ) : (
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-warning-700"
                      aria-hidden
                    />
                  )}
                  <span>
                    <span className="block">{line.text}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('gapFill.shell.gateGoToStep', { step: line.step })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('gapFill.step1.cancel')}
          </Button>
          <Button type="button" disabled={blockerCount > 0} onClick={() => onOpenChange(false)}>
            {blockerCount > 0
              ? t('gapFill.shell.gateBlocked', { count: blockerCount })
              : t('gapFill.shell.gateDone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
