'use client';

import { useTranslations } from 'next-intl';
import { Play, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { Columns2, Highlighter, Text } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  formatSeconds,
  hasMaterial,
  MODES,
  modeConfig,
  RA_MAX_PROMPTS,
  readSeconds,
  wordCount,
  type Mode,
  type Prompt,
} from '@/lib/shared-kernel/read-aloud';

import { AudioEnableRow, AudioRulesCard, AudioSourceCard } from '../audio';
import { Callout, Card, Field, StepHead } from '../highlight-in-text/parts';
import { ImageSlot } from '../writing-task/image-slot';
import {
  addPoint,
  addPrompt,
  removePoint,
  removePrompt,
  setInstruction,
  setMode,
  setPointText,
  setPrompt,
  setTitle,
  togglePointRequired,
  type ReadAloudDocument,
} from './edits';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;
const MONO = { fontFamily: 'var(--ssz-font-mono)' } as const;

const MODE_ICONS: Record<Mode, LucideIcon> = {
  read: Text,
  monologue: Highlighter,
  dialogue: Columns2,
};

/** `ra-ptext`: the reading-face textarea of a passage or a partner's line. */
function ptext(bad: boolean, tall: boolean): string {
  return `w-full resize-y rounded-(--ssz-radius-sm) border bg-(--ssz-bg-surface) px-3 py-[11px] text-lg leading-relaxed placeholder:text-(--ssz-text-muted) focus-visible:border-(--ssz-border-focus) focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none ${
    bad ? 'border-(--ssz-color-error-500)' : 'border-(--ssz-border-strong)'
  } ${tall ? 'min-h-[84px]' : 'min-h-[60px]'}`;
}

const DELETE = 'hover:bg-(--ssz-color-error-50) hover:text-(--ssz-color-error-700)';

export interface StepTaskProps {
  exercise: ReadAloudDocument;
  onChange: (next: ReadAloudDocument) => void;
}

/**
 * Step 1: the task — a title, the mode, the instruction line, then one card per prompt with the
 * material its mode needs (plan 70 §7.2).
 *
 * The mode picker keeps every prompt's material: a passage typed and then switched away from
 * comes back when the author switches back, and only the three lengths are reset (the kernel's
 * `setMode`). The prompt cards draw the fields of the current mode and nothing else — what the
 * kernel's `hasMaterial` asks for is what is drawn red when it is missing.
 */
export function StepTask({ exercise, onChange }: StepTaskProps) {
  const t = useTranslations('Authoring.readAloud');
  const needs = modeConfig(exercise.mode).needs;
  const count = exercise.prompts.length;

  const patch = (id: string, next: Partial<Omit<Prompt, 'id'>>) =>
    onChange(setPrompt(exercise, id, next));

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('step1.eyebrow')} title={t('step1.title')} lede={t('step1.lede')} />

      <Card>
        <Field label={t('step1.titleLabel')} htmlFor="ra-title" required>
          <Input
            id="ra-title"
            value={exercise.title}
            placeholder={t('step1.titlePlaceholder')}
            onChange={(event) => onChange(setTitle(exercise, event.target.value))}
          />
        </Field>

        <Field label={t('step1.modeLabel')}>
          <div
            role="group"
            aria-label={t('step1.modeLabel')}
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}
          >
            {MODES.map((config) => {
              const Icon = MODE_ICONS[config.id];
              const on = exercise.mode === config.id;
              return (
                <button
                  key={config.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(setMode(exercise, config.id))}
                  className={`flex flex-col items-start gap-[3px] rounded-(--ssz-radius-md) border p-3 text-left focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none ${
                    on
                      ? 'border-(--ssz-color-primary-500) bg-(--ssz-color-primary-50) shadow-[inset_0_0_0_1px_var(--ssz-color-primary-500)]'
                      : 'border-(--ssz-border-strong) bg-(--ssz-bg-surface) hover:border-(--ssz-color-primary-400)'
                  }`}
                >
                  <Icon size={17} aria-hidden="true" className="text-(--ssz-color-primary-600)" />
                  <b className="text-sm font-semibold">{t(`modes.${config.id}.label`)}</b>
                  <span className="text-xs leading-snug text-(--ssz-text-secondary)">
                    {t(`modes.${config.id}.desc`)}
                  </span>
                  <em className="mt-1 text-[10px] text-(--ssz-text-muted) not-italic" style={MONO}>
                    {t('step1.retrieval', { value: config.modality })}
                  </em>
                </button>
              );
            })}
          </div>
          <p className="m-0 mt-2 text-xs text-(--ssz-text-muted)">
            {exercise.mode === 'read' ? t('step1.evidenceRead') : t('step1.evidenceProduce')}
          </p>
        </Field>

        <Field
          label={t('step1.instructionLabel')}
          htmlFor="ra-instruction"
          message={{ tone: 'hint', text: t('step1.instructionHelp'), id: 'ra-instruction-help' }}
        >
          <Input
            id="ra-instruction"
            aria-describedby="ra-instruction-help"
            style={READING}
            value={exercise.instruction}
            placeholder={t('step1.instructionPlaceholder')}
            onChange={(event) => onChange(setInstruction(exercise, event.target.value))}
          />
        </Field>
      </Card>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-(--ssz-color-primary-600)">
            {t('step1.promptsEyebrow')}
          </p>
          <h3 className="m-0 mt-1 text-lg font-bold tracking-tight">
            {t('step1.promptsCount', { count })}
          </h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={count >= RA_MAX_PROMPTS}
          onClick={() => onChange(addPrompt(exercise))}
        >
          <Plus className="size-4" aria-hidden />
          {t('step1.addPrompt')}
        </Button>
      </div>

      <Callout tone="tip">{t.rich('step1.promptsTip', { b: (chunks) => <b>{chunks}</b> })}</Callout>

      {exercise.prompts.map((prompt, i) => {
        const bad = !hasMaterial(prompt, exercise.mode);
        const label =
          prompt.label.trim() === '' ? t('subject.prompt', { index: i + 1 }) : prompt.label;
        return (
          <section
            key={prompt.id}
            aria-label={label}
            data-bad={bad ? 'true' : undefined}
            className={`rounded-(--ssz-radius-md) border bg-(--ssz-bg-surface) ${
              bad ? 'border-(--ssz-color-error-500)' : 'border-(--ssz-border-default)'
            }`}
            style={{ boxShadow: 'var(--ssz-shadow-xs)' }}
          >
            <div className="flex items-center gap-2 border-b border-(--ssz-border-default) py-2 pr-2 pl-3">
              <span
                aria-hidden="true"
                className="grid size-5 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
              >
                {i + 1}
              </span>
              <Input
                aria-label={t('step1.promptLabel', { index: i + 1 })}
                className="max-w-[220px] px-2 py-[5px]"
                value={prompt.label}
                placeholder={t('subject.prompt', { index: i + 1 })}
                onChange={(event) => patch(prompt.id, { label: event.target.value })}
              />
              <span className="text-[10px] text-(--ssz-text-muted)" style={MONO}>
                {prompt.id}
              </span>
              <span className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={DELETE}
                disabled={count < 2}
                aria-label={t('step1.removePrompt', { label })}
                onClick={() => onChange(removePrompt(exercise, prompt.id))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="flex flex-col gap-2.5 p-4">
              {needs === 'text' && <ReadingFields prompt={prompt} id={prompt.id} onPatch={patch} />}
              {needs === 'support' && (
                <SupportFields
                  exercise={exercise}
                  prompt={prompt}
                  onChange={onChange}
                  onPatch={patch}
                />
              )}
              {needs === 'turn' && <TurnFields prompt={prompt} onPatch={patch} />}
            </div>
          </section>
        );
      })}

      <Card
        icon={Play}
        title={t('step1.audioTitle')}
        note={<span style={MONO}>{t('step1.audioNote')}</span>}
      >
        <AudioEnableRow
          draft={exercise.audio}
          onChange={(audio) => onChange({ ...exercise, audio })}
        />
        {exercise.audio.audio.enabled ? (
          <>
            <AudioSourceCard
              draft={exercise.audio}
              onChange={(audio) => onChange({ ...exercise, audio })}
            />
            <AudioRulesCard
              draft={exercise.audio}
              onChange={(audio) => onChange({ ...exercise, audio })}
              itemNoun={t('audioItemNoun')}
              segments={false}
            />
          </>
        ) : (
          <p className="m-0 text-xs text-(--ssz-text-muted)">
            {t(`step1.audioOff.${exercise.mode}`)}
          </p>
        )}
      </Card>
    </div>
  );
}

type Patch = (id: string, next: Partial<Omit<Prompt, 'id'>>) => void;

/** `read` — the passage, with its length against the clock. */
function ReadingFields({ prompt, id, onPatch }: { prompt: Prompt; id: string; onPatch: Patch }) {
  const t = useTranslations('Authoring.readAloud');
  const empty = prompt.text.trim() === '';
  const messageId = `ra-text-${id}-msg`;

  return (
    <Field
      label={t('step1.textLabel')}
      htmlFor={`ra-text-${id}`}
      required
      message={
        empty
          ? { tone: 'error', text: t('step1.textRequired'), id: messageId }
          : {
              tone: 'hint',
              text: t('step1.textMeasure', {
                words: wordCount(prompt.text),
                time: formatSeconds(readSeconds(prompt.text)),
              }),
              id: messageId,
            }
      }
    >
      <textarea
        id={`ra-text-${id}`}
        aria-describedby={messageId}
        aria-invalid={empty}
        className={ptext(empty, true)}
        style={READING}
        value={prompt.text}
        placeholder={t('step1.textPlaceholder')}
        onChange={(event) => onPatch(id, { text: event.target.value })}
      />
    </Field>
  );
}

/** `monologue` — a picture, and the plan the student sees beside the microphone. */
function SupportFields({
  exercise,
  prompt,
  onChange,
  onPatch,
}: {
  exercise: ReadAloudDocument;
  prompt: Prompt;
  onChange: (next: ReadAloudDocument) => void;
  onPatch: Patch;
}) {
  const t = useTranslations('Authoring.readAloud');

  return (
    <>
      <ImageSlot
        image={prompt.image}
        onChange={(image) =>
          onPatch(prompt.id, { image: { ...image, assetId: image.assetId ?? '' } })
        }
      />

      <Field
        label={t('step1.planLabel')}
        message={{ tone: 'hint', text: t('step1.planHelp'), id: `ra-plan-${prompt.id}-help` }}
      >
        <div className="flex flex-col gap-2">
          {prompt.plan.map((point, index) => (
            <div
              key={point.id}
              className="grid items-center gap-[9px]"
              style={{ gridTemplateColumns: '22px minmax(0, 1fr) auto 30px' }}
            >
              <span
                aria-hidden="true"
                className="grid size-5 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
              >
                {index + 1}
              </span>
              <Input
                aria-label={t('step1.pointText', { index: index + 1 })}
                value={point.text}
                placeholder={t('step1.pointPlaceholder')}
                onChange={(event) =>
                  onChange(setPointText(exercise, prompt.id, point.id, event.target.value))
                }
              />
              <button
                type="button"
                aria-pressed={point.required}
                onClick={() => onChange(togglePointRequired(exercise, prompt.id, point.id))}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none ${
                  point.required
                    ? 'border-(--ssz-color-success-200) bg-(--ssz-color-success-50) text-(--ssz-color-success-700)'
                    : 'border-(--ssz-border-default) bg-(--ssz-bg-subtle) text-(--ssz-text-secondary)'
                }`}
              >
                {point.required ? t('step1.pointRequired') : t('step1.pointOptional')}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={DELETE}
                aria-label={t('step1.removePoint', { index: index + 1 })}
                onClick={() => onChange(removePoint(exercise, prompt.id, point.id))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(addPoint(exercise, prompt.id))}
            >
              <Plus className="size-4" aria-hidden />
              {t('step1.addPoint')}
            </Button>
          </div>
        </div>
      </Field>
    </>
  );
}

/** `dialogue` — the situation and the line the student answers. */
function TurnFields({ prompt, onPatch }: { prompt: Prompt; onPatch: Patch }) {
  const t = useTranslations('Authoring.readAloud');
  const partnerEmpty = prompt.turn.partner.trim() === '';
  const messageId = `ra-partner-${prompt.id}-msg`;

  return (
    <>
      <Field
        label={t('step1.situationLabel')}
        htmlFor={`ra-situation-${prompt.id}`}
        message={{
          tone: 'hint',
          text: t('step1.situationHelp'),
          id: `ra-situation-${prompt.id}-help`,
        }}
      >
        <Input
          id={`ra-situation-${prompt.id}`}
          aria-describedby={`ra-situation-${prompt.id}-help`}
          style={READING}
          value={prompt.turn.situation}
          placeholder={t('step1.situationPlaceholder')}
          onChange={(event) =>
            onPatch(prompt.id, { turn: { ...prompt.turn, situation: event.target.value } })
          }
        />
      </Field>
      <Field
        label={t('step1.partnerLabel')}
        htmlFor={`ra-partner-${prompt.id}`}
        required
        message={
          partnerEmpty
            ? { tone: 'error', text: t('step1.partnerRequired'), id: messageId }
            : undefined
        }
      >
        <textarea
          id={`ra-partner-${prompt.id}`}
          aria-describedby={partnerEmpty ? messageId : undefined}
          aria-invalid={partnerEmpty}
          className={ptext(partnerEmpty, false)}
          style={READING}
          value={prompt.turn.partner}
          placeholder={t('step1.partnerPlaceholder')}
          onChange={(event) =>
            onPatch(prompt.id, { turn: { ...prompt.turn, partner: event.target.value } })
          }
        />
      </Field>
    </>
  );
}
