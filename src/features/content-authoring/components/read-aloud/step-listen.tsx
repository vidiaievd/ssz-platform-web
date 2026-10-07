'use client';

import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { focusAt, hasNote, passagePieces, type Prompt } from '@/lib/shared-kernel/read-aloud';

import { Callout, Field, StepHead } from '../highlight-in-text/parts';
import {
  removeFocus,
  setFocusNote,
  setNote,
  toggleFocusWord,
  type ReadAloudDocument,
} from './edits';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;
const MONO = { fontFamily: 'var(--ssz-font-mono)' } as const;

export interface StepListenProps {
  exercise: ReadAloudDocument;
  onChange: (next: ReadAloudDocument) => void;
}

/**
 * Step 2: what the grader listens for (plan 70 §7.3) — the sounds to mark in each passage and
 * the note that says what a good recording is on that prompt.
 *
 * Nothing here reaches the student before the verdict (the kernel keeps all of it in
 * `expected_answers`), and the note is a blocker: a recording that comes back «3 av 12» with no
 * reason costs the student the lesson (README idea 2).
 */
export function StepListen({ exercise, onChange }: StepListenProps) {
  const t = useTranslations('Authoring.readAloud');

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('step2.eyebrow')} title={t('step2.title')} lede={t('step2.lede')} />

      <Callout tone="warn">{t('step2.warn')}</Callout>

      {exercise.prompts.map((prompt, i) => (
        <PromptCard
          key={prompt.id}
          exercise={exercise}
          prompt={prompt}
          index={i + 1}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function PromptCard({
  exercise,
  prompt,
  index,
  onChange,
}: {
  exercise: ReadAloudDocument;
  prompt: Prompt;
  index: number;
  onChange: (next: ReadAloudDocument) => void;
}) {
  const t = useTranslations('Authoring.readAloud');
  const label = prompt.label.trim() === '' ? t('subject.prompt', { index }) : prompt.label;
  const noNote = !hasNote(prompt);
  const noteMessage = `ra-note-${prompt.id}-msg`;
  const picker = exercise.mode === 'read' && prompt.text.trim() !== '';

  return (
    <section
      aria-label={label}
      data-bad={noNote ? 'true' : undefined}
      className={`rounded-(--ssz-radius-md) border bg-(--ssz-bg-surface) ${
        noNote ? 'border-(--ssz-color-error-500)' : 'border-(--ssz-border-default)'
      }`}
      style={{ boxShadow: 'var(--ssz-shadow-xs)' }}
    >
      <div className="flex items-center gap-2 border-b border-(--ssz-border-default) py-2 pr-3 pl-3">
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
        >
          {index}
        </span>
        <strong className="text-sm">{label}</strong>
        <span className="flex-1" />
        <span className="text-[10px] text-(--ssz-text-muted)" style={MONO}>
          {prompt.id}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {picker && (
          <Field
            label={t('step2.pickLabel')}
            message={{ tone: 'hint', text: t('step2.pickHelp'), id: `ra-pick-${prompt.id}-help` }}
          >
            <p
              role="group"
              aria-label={t('step2.pickLabel')}
              aria-describedby={`ra-pick-${prompt.id}-help`}
              className="m-0 text-lg"
              style={{ ...READING, lineHeight: 2.1, textWrap: 'pretty' }}
            >
              {passagePieces(prompt.text).map((piece, at) =>
                piece.word === undefined ? (
                  <Fragment key={at}>{piece.text}</Fragment>
                ) : (
                  <button
                    key={at}
                    type="button"
                    aria-pressed={focusAt(prompt, piece.word) !== undefined}
                    onClick={() =>
                      onChange(toggleFocusWord(exercise, prompt.id, piece.word as string))
                    }
                    className={`rounded-md border px-1 py-0.5 hover:bg-(--ssz-bg-muted) focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none ${
                      focusAt(prompt, piece.word) === undefined
                        ? 'border-transparent'
                        : 'border-(--ssz-color-primary-200) bg-(--ssz-color-primary-100) font-semibold text-(--ssz-color-primary-800) hover:bg-(--ssz-color-primary-100)'
                    }`}
                  >
                    {piece.text}
                  </button>
                ),
              )}
            </p>
          </Field>
        )}

        {prompt.focus.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {prompt.focus.map((focus) => (
              <li
                key={focus.id}
                className="grid items-center gap-[9px] rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-surface) px-2.5 py-1.5 max-[820px]:grid-cols-[minmax(0,1fr)_30px] min-[821px]:grid-cols-[minmax(90px,.8fr)_minmax(0,2.2fr)_30px]"
              >
                <b className="truncate text-base" style={READING}>
                  {focus.word}
                </b>
                <Input
                  aria-label={t('step2.focusNoteLabel', { word: focus.word })}
                  className="border-transparent bg-transparent px-2 py-1.5 hover:border-transparent focus-visible:border-(--ssz-border-focus) focus-visible:bg-(--ssz-bg-surface) max-[820px]:col-span-2 max-[820px]:row-start-2"
                  value={focus.note}
                  placeholder={t('step2.focusNotePlaceholder')}
                  onChange={(event) =>
                    onChange(setFocusNote(exercise, prompt.id, focus.id, event.target.value))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="hover:bg-(--ssz-color-error-50) hover:text-(--ssz-color-error-700)"
                  aria-label={t('step2.removeFocus', { word: focus.word })}
                  onClick={() => onChange(removeFocus(exercise, prompt.id, focus.id))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Field
          label={t('step2.noteLabel')}
          htmlFor={`ra-note-${prompt.id}`}
          required
          message={
            noNote ? { tone: 'error', text: t('step2.noteRequired'), id: noteMessage } : undefined
          }
        >
          <Textarea
            id={`ra-note-${prompt.id}`}
            aria-describedby={noNote ? noteMessage : undefined}
            aria-invalid={noNote}
            hasError={noNote}
            value={prompt.note}
            placeholder={t('step2.notePlaceholder')}
            onChange={(event) => onChange(setNote(exercise, prompt.id, event.target.value))}
          />
        </Field>
      </div>
    </section>
  );
}
