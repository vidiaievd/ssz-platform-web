'use client';

import { useState } from 'react';
import { AlertTriangle, AlignLeft, Check, Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MarkableText } from '@/features/student/exercises/runner/markable-text';
import {
  previewReanchor,
  tokenize,
  type HighlightInTextContent,
} from '@/lib/shared-kernel/highlight-in-text';

import { setInstruction, setText, setTitle } from './edits';
import { Callout, Card, Field, StepHead } from './parts';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;

export interface StepTextProps<T extends HighlightInTextContent> {
  exercise: T;
  onChange: (next: T) => void;
}

/**
 * Step 1: the text — one passage, marked in place (plan 67 §7.3, BEHAVIOR §2).
 *
 * The text area is a **draft**: nothing re-anchors while typing. When the draft differs from
 * the saved passage, «Apply the edit» commits it and the kernel re-finds every mark by its
 * words (AC-R1, R2); a mark whose words are gone becomes an orphan in step 2 rather than
 * disappearing (AC-R3). «See what moves» runs the same re-anchor without committing and
 * reports how many would be lost (AC-R5) — the same function, so the count cannot disagree
 * with what applying does.
 *
 * Under the area the passage is drawn as the student will see it — the one renderer, marking
 * off — so line breaks and paragraphs are checked here, not in the preview.
 */
export function StepText<T extends HighlightInTextContent>({
  exercise,
  onChange,
}: StepTextProps<T>) {
  const t = useTranslations('Authoring.highlightInText.step1');

  const [draft, setDraft] = useState(exercise.text);
  const [base, setBase] = useState(exercise.text);
  /** New orphans the pending edit would make — `null` until «See what moves» is pressed. */
  const [lost, setLost] = useState<number | null>(null);

  // The saved passage changed under the draft (applied here, or a save came back): the
  // draft follows it. Adjusted during render, not in an effect, so no frame shows the old one.
  if (exercise.text !== base) {
    setBase(exercise.text);
    setDraft(exercise.text);
    setLost(null);
  }

  const dirty = draft !== exercise.text;
  const marks = exercise.questions.reduce((n, q) => n + q.spans.length, 0);
  const draftWords = tokenize(draft).length;
  const words = tokenize(exercise.text).length;

  const apply = () => onChange(setText(exercise, draft));
  const inspect = () => setLost(previewReanchor(exercise, draft).lost);

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card>
        <Field label={t('titleLabel')} htmlFor="ht-title" required>
          <Input
            id="ht-title"
            value={exercise.title}
            placeholder={t('titlePlaceholder')}
            aria-required
            onChange={(event) => onChange(setTitle(exercise, event.target.value))}
          />
        </Field>
        <Field
          label={t('instructionLabel')}
          htmlFor="ht-instruction"
          message={{ tone: 'hint', text: t('instructionHelp'), id: 'ht-instruction-help' }}
        >
          <Input
            id="ht-instruction"
            aria-describedby="ht-instruction-help"
            className="text-base"
            style={READING}
            value={exercise.instruction}
            placeholder={t('instructionPlaceholder')}
            onChange={(event) => onChange(setInstruction(exercise, event.target.value))}
          />
        </Field>
      </Card>

      <Card
        icon={AlignLeft}
        title={t('passageTitle')}
        labelledBy="ht-passage-title"
        note={t('passageNote', { count: draftWords })}
      >
        <Textarea
          aria-labelledby="ht-passage-title"
          rows={10}
          className="text-base"
          style={{ ...READING, fieldSizing: 'fixed' }}
          value={draft}
          placeholder={t('passagePlaceholder')}
          onChange={(event) => {
            setDraft(event.target.value);
            setLost(null);
          }}
        />

        {dirty && marks > 0 && (
          <Callout tone="warn">
            <b className="font-semibold">{t('pending.title', { count: marks })}</b>{' '}
            {t('pending.body')}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={inspect}>
                <Eye className="size-3.5" aria-hidden />
                {t('pending.inspect')}
              </Button>
              <Button type="button" size="sm" onClick={apply}>
                <Check className="size-3.5" aria-hidden />
                {t('pending.apply')}
              </Button>
            </div>
            {lost !== null && (
              <p
                role="status"
                className="m-0 mt-2 flex items-start gap-[5px] text-xs"
                style={{
                  color: lost > 0 ? 'var(--ssz-color-error-700)' : 'var(--ssz-color-success-700)',
                }}
              >
                {lost > 0 ? (
                  <AlertTriangle size={13} aria-hidden="true" className="mt-px shrink-0" />
                ) : (
                  <Check size={13} aria-hidden="true" className="mt-px shrink-0" />
                )}
                {lost > 0 ? t('pending.lost', { count: lost }) : t('pending.kept')}
              </p>
            )}
          </Callout>
        )}

        {dirty && marks === 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={apply}>
              <Check className="size-3.5" aria-hidden />
              {t('pending.apply')}
            </Button>
            <span className="text-xs text-(--ssz-text-muted)">{t('pending.nothing')}</span>
          </div>
        )}
      </Card>

      {words > 0 && (
        <Card
          icon={Eye}
          title={t('readsTitle')}
          labelledBy="ht-reads-title"
          note={t('readsNote', { count: exercise.questions.length })}
          flush
        >
          <div className="px-5 pt-5 pb-4">
            <MarkableText text={exercise.text} selectable labelledBy="ht-reads-title" />
          </div>
        </Card>
      )}

      <Callout tone="tip">{t('tip')}</Callout>
    </div>
  );
}
