'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
  FileText,
  Image as ImageIcon,
  Info,
  Mail,
  PenLine,
  Plus,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  analyse,
  MODES,
  modeConfig,
  usablePoints,
  type LetterRegister,
  type Mode,
  type WritingTask,
} from '@/lib/shared-kernel/writing-task';

import {
  addKeyword,
  addPhrase,
  addPoint,
  isDefaultRange,
  MAX_POINTS,
  removeKeyword,
  removePhrase,
  removePoint,
  setMode,
  setPoint,
  setSettings,
} from './edits';
import { ChipEditor } from '../chip-editor';
import type { AudioDraft } from '@/lib/shared-kernel/audio';

import { AudioEnableRow, AudioSourceCard } from '../audio';
import { ImageSlot } from './image-slot';

const MODE_ICONS: Record<Mode, typeof Mail> = {
  letter: Mail,
  essay: FileText,
  picture: ImageIcon,
  retell: BookOpen,
  free: PenLine,
};

const REGISTERS: LetterRegister[] = ['formal', 'informal'];

export interface StepTaskProps {
  exercise: WritingTask;
  onChange: (next: WritingTask) => void;
  /**
   * The listening layer, held beside the document by the builder (plan 56 phase 6).
   *
   * A clip on this template is a stimulus — listen, then write — so only the switch and
   * the source are offered: there is nothing to time, nothing to gate and no listen worth
   * rationing when the answer is a paragraph the student writes in their own time.
   */
  audio: AudioDraft;
  onAudioChange: (next: AudioDraft) => void;
}

/**
 * Step 1: what the student is asked to write.
 *
 * Controlled and presentational — a document in, a document out. Everything derived (what
 * is missing, what the example answer covers) comes from the kernel, so this screen and
 * the server never disagree about the same text.
 *
 * The mode picker is first because it decides what the rest of the step even shows.
 * Choosing one keeps every text field — an author who mislabels a task and fixes it must
 * not lose the prompt — and resets the word range, which is a number nobody chose. That
 * rule lives in `edits.ts`, not here.
 *
 * Except when the author *did* choose it. A range they typed is work, and a switch that
 * replaced it silently would be the one thing this step takes away without saying so —
 * so it says so, in a line under the picker, with the old numbers one click away. A
 * confirmation before the switch was the other option and it asks the wrong question:
 * nothing is lost yet at that point, and a modal in front of every correction of the
 * task type would charge the common case for the rare one.
 *
 * There is no title field, as in the four builders before it: the platform has no title
 * on an exercise.
 */
export function StepTask({ exercise, onChange, audio, onAudioChange }: StepTaskProps) {
  const t = useTranslations('Authoring');
  const needs = modeConfig(exercise.mode).needs;
  const points = exercise.points;
  const promptEmpty = exercise.prompt.trim() === '';

  /** The two other step-1 blockers that belong to a field on this screen. */
  const noSource = needs === 'source' && exercise.source.trim() === '';
  const noImage = needs === 'image' && (exercise.image.assetId ?? '') === '';

  /** No point carries any text yet — the blocker the step-1 dot reports. */
  const noPoints = usablePoints(exercise).length === 0;

  /** The range the last mode switch replaced, while it is still the one on screen. */
  const [replaced, setReplaced] = useState<{ min: number; max: number } | null>(null);

  const chooseMode = (mode: Mode) => {
    if (mode === exercise.mode) return;
    // Only the author's own numbers are worth a line. A range still sitting at the old
    // mode's default was nobody's decision, and reporting its replacement would be noise
    // in the ordinary case of picking the right kind of text on the first try.
    setReplaced(
      isDefaultRange(exercise)
        ? null
        : { min: exercise.settings.minWords, max: exercise.settings.maxWords },
    );
    onChange(setMode(exercise, mode));
  };

  const undoRange = () => {
    if (replaced === null) return;
    onChange(setSettings(exercise, { minWords: replaced.min, maxWords: replaced.max }));
    setReplaced(null);
  };

  // The line answers for the range as it stands now. Once the author has set it themselves
  // on step 2 — or undone it here — there is nothing left to report.
  const rangeReplaced = replaced !== null && isDefaultRange(exercise);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('writingTask.step1.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('writingTask.step1.lede')}</p>
      </div>

      {/* Listening as a stimulus: the clip is what the student writes about. No gate and
          no listen limit — the answer is written in their own time (plan 56 phase 6). */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <AudioEnableRow draft={audio} onChange={onAudioChange} />
      </div>

      {audio.audio.enabled && <AudioSourceCard draft={audio} onChange={onAudioChange} />}

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('writingTask.step1.modeLabel')}</h3>
        <div
          role="radiogroup"
          aria-label={t('writingTask.step1.modeLabel')}
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {MODES.map((config) => {
            const Icon = MODE_ICONS[config.id];
            const selected = exercise.mode === config.id;

            return (
              <button
                key={config.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseMode(config.id)}
                className={`flex items-start gap-2.5 rounded-lg border-2 p-3 text-left transition-colors ${
                  selected
                    ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-50) dark:bg-(--ssz-color-primary-950)'
                    : 'border-border bg-surface hover:bg-subtle'
                }`}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-(--ssz-text-secondary)" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {t(`writingTask.modes.${config.id}` as 'writingTask.modes.letter')}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`writingTask.modeHints.${config.id}` as 'writingTask.modeHints.letter')}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {rangeReplaced && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" aria-hidden />
            {t('writingTask.step1.rangeReset', {
              min: exercise.settings.minWords,
              max: exercise.settings.maxWords,
              mode: t(`writingTask.modes.${exercise.mode}` as 'writingTask.modes.letter'),
            })}
            <Button type="button" variant="link" size="sm" onClick={undoRange}>
              {t('writingTask.step1.rangeResetUndo', { min: replaced.min, max: replaced.max })}
            </Button>
          </p>
        )}
      </section>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor="wt-instruction">
          {t('writingTask.step1.instructionLabel')}
        </label>
        <Input
          id="wt-instruction"
          aria-describedby="wt-instruction-help"
          value={exercise.instruction}
          placeholder={t('writingTask.step1.instructionPlaceholder')}
          onChange={(event) => onChange({ ...exercise, instruction: event.target.value })}
        />
        <p id="wt-instruction-help" className="text-xs text-muted-foreground">
          {t('writingTask.step1.instructionHelp')}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor="wt-prompt">
          {t('writingTask.step1.promptLabel')}
        </label>
        <Textarea
          id="wt-prompt"
          aria-describedby="wt-prompt-help"
          value={exercise.prompt}
          rows={4}
          hasError={promptEmpty}
          aria-invalid={promptEmpty}
          placeholder={t('writingTask.step1.promptPlaceholder')}
          onChange={(event) => onChange({ ...exercise, prompt: event.target.value })}
        />
        {/* The message sits next to the field rather than replacing its help line,
            because `aria-invalid` on its own says "wrong" and not what to do. */}
        <p
          id="wt-prompt-help"
          className={`text-xs ${promptEmpty ? 'text-error' : 'text-muted-foreground'}`}
        >
          {promptEmpty ? t('writingTask.step1.promptRequired') : t('writingTask.step1.promptHelp')}
        </p>
      </div>

      {/* Material, per mode. `needs` is the kernel's table, read here and by the
          validator, so a sixth subtype means one row there rather than two edits. */}
      {needs === 'letter' && (
        <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            {t('writingTask.step1.recipientLabel')}
            <Input
              value={exercise.letter.recipient}
              placeholder={t('writingTask.step1.recipientPlaceholder')}
              onChange={(event) =>
                onChange({
                  ...exercise,
                  letter: { ...exercise.letter, recipient: event.target.value },
                })
              }
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t('writingTask.step1.registerLabel')}</span>
            <Segmented
              aria-label={t('writingTask.step1.registerLabel')}
              value={exercise.letter.register}
              onValueChange={(register) =>
                onChange({ ...exercise, letter: { ...exercise.letter, register } })
              }
              options={REGISTERS.map((register) => ({
                value: register,
                label: t(
                  `writingTask.step1.register_${register}` as 'writingTask.step1.register_formal',
                ),
              }))}
            />
          </div>
        </div>
      )}

      {needs === 'image' && (
        <div className="flex flex-col gap-1">
          <ImageSlot image={exercise.image} onChange={(image) => onChange({ ...exercise, image })} />
          {noImage && (
            <p className="text-xs text-error" role="status">
              {t('writingTask.issues.MODE_NO_IMAGE')}
            </p>
          )}
        </div>
      )}

      {needs === 'source' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor="wt-source">
            {t('writingTask.step1.sourceLabel')}
          </label>
          <Textarea
            id="wt-source"
            aria-describedby="wt-source-help"
            value={exercise.source}
            rows={6}
            hasError={noSource}
            aria-invalid={noSource}
            placeholder={t('writingTask.step1.sourcePlaceholder')}
            onChange={(event) => onChange({ ...exercise, source: event.target.value })}
          />
          <p
            id="wt-source-help"
            className={`text-xs ${noSource ? 'text-error' : 'text-muted-foreground'}`}
          >
            {noSource ? t('writingTask.issues.MODE_NO_SOURCE') : t('writingTask.step1.sourceHelp')}
          </p>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('writingTask.step1.pointsLabel')}</h3>

        {/*
          The step's dot goes red for this, and until now the reason lived only inside the
          gate dialog — a marker on a step with nothing marked on the step itself. An empty
          row counts as no point at all (`usablePoints`), which is why the sentence says
          "written" rather than "added": an author looking at one blank row and a red dot
          otherwise has no way to connect the two.
        */}
        {noPoints && (
          <p className="text-xs text-error" role="status">
            {t('writingTask.issues.EX_NO_POINTS')}
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {points.map((point, index) => (
            <li
              key={point.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
            >
              <div className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 grid size-5 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
                >
                  {index + 1}
                </span>
                <Input
                  value={point.text}
                  aria-label={t('writingTask.step1.pointText', { index: index + 1 })}
                  placeholder={t('writingTask.step1.pointPlaceholder')}
                  // Red only while there is no usable point at all. A blank row next to
                  // three written ones is a row the author is about to fill in, not a
                  // fault — the exercise is fine either way.
                  hasError={noPoints}
                  aria-invalid={noPoints}
                  onChange={(event) =>
                    onChange(setPoint(exercise, point.id, { text: event.target.value }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={points.length <= 1}
                  aria-label={t('writingTask.step1.removePoint', { index: index + 1 })}
                  onClick={() => onChange(removePoint(exercise, point.id))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-7">
                <ChipEditor
                  values={point.keywords}
                  label={t('writingTask.step1.keywordsLabel', { index: index + 1 })}
                  placeholder={t('writingTask.step1.keywordsPlaceholder')}
                  removeLabel={(keyword) => t('writingTask.step1.removeKeyword', { keyword })}
                  onAdd={(keyword) => onChange(addKeyword(exercise, point.id, keyword))}
                  onRemove={(keyword) => onChange(removeKeyword(exercise, point.id, keyword))}
                />
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={point.required}
                    onCheckedChange={(checked) =>
                      onChange(setPoint(exercise, point.id, { required: checked === true }))
                    }
                  />
                  {t('writingTask.step1.requiredLabel')}
                </label>
              </div>
            </li>
          ))}
        </ul>

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={points.length >= MAX_POINTS}
            onClick={() => onChange(addPoint(exercise))}
          >
            <Plus className="size-4" aria-hidden />
            {t('writingTask.step1.addPoint')}
          </Button>
        </div>

        <Callout>{t('writingTask.step1.keywordsNote')}</Callout>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium">{t('writingTask.step1.phrasesLabel')}</h3>
        <ChipEditor
          values={exercise.phrases}
          label={t('writingTask.step1.phrasesLabel')}
          placeholder={t('writingTask.step1.phrasesPlaceholder')}
          removeLabel={(phrase) => t('writingTask.step1.removePhrase', { phrase })}
          onAdd={(phrase) => onChange(addPhrase(exercise, phrase))}
          onRemove={(phrase) => onChange(removePhrase(exercise, phrase))}
        />
        <p className="text-xs text-muted-foreground">{t('writingTask.step1.phrasesHelp')}</p>
      </section>

      <ModelAnswer exercise={exercise} onChange={onChange} />
    </div>
  );
}

/**
 * The example answer, and what the analysis engine makes of it.
 *
 * The readout is the only self-test a free text has. Every other template can be checked
 * against its own key — type the answer, see it accepted — and this one cannot, because
 * there is no key: a person marks it. What the author *can* learn from their own text is
 * whether the task they wrote is answerable in the range they set and whether their
 * keywords actually match the way a competent answer phrases each point.
 *
 * A point missed here almost never means the model answer is weak. It means the keywords
 * for that point do not match how anyone would write it — which is worth knowing before
 * an AI pre-check is built on top of them, and harmless until then.
 */
function ModelAnswer({
  exercise,
  onChange,
}: Pick<StepTaskProps, 'exercise' | 'onChange'>) {
  const t = useTranslations('Authoring');
  const analysis = analyse(exercise, exercise.model);
  const written = exercise.model.trim() !== '';
  const covered = analysis.cover.filter((point) => point.hit).length;
  const total = usablePoints(exercise).length;
  const allCovered = total > 0 && covered === total;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" htmlFor="wt-model">
        {t('writingTask.step1.modelLabel')}
      </label>
      <Textarea
        id="wt-model"
        aria-describedby="wt-model-help"
        value={exercise.model}
        rows={6}
        placeholder={t('writingTask.step1.modelPlaceholder')}
        onChange={(event) => onChange({ ...exercise, model: event.target.value })}
      />
      {written ? (
        <p
          id="wt-model-help"
          role="status"
          className={`text-xs ${allCovered ? 'text-success-700' : 'text-warning-700'}`}
        >
          {t('writingTask.step1.modelReadout', {
            words: analysis.words,
            paragraphs: analysis.paragraphs,
            covered,
            total,
          })}
        </p>
      ) : (
        <p id="wt-model-help" className="text-xs text-muted-foreground">
          {t('writingTask.step1.modelHelp')}
        </p>
      )}
    </div>
  );
}

/** A quiet note the author is meant to read once, not a warning about their document. */
function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-(--ssz-bg-subtle) p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
