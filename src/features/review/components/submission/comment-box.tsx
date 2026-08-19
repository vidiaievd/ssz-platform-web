'use client';

import { useId, useState, type RefObject } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { CharPad } from '@/components/shared/char-pad';
import { cn } from '@/lib/utils';

/** The letters a keyboard bought outside Norway does not have. */
const NORWEGIAN_CHARS = ['æ', 'ø', 'å'] as const;

/** What the engine accepts against one sentence (`review-attempt.dto.ts`). */
const SENTENCE_COMMENT_MAX = 2000;

export interface CommentBoxProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
  /** The upstream ceiling, enforced where it can still be typed under rather than hit. */
  maxLength?: number;
  /** So a refusal can put the cursor where the fix goes (criterion 18). */
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  /** What is wrong with what is written, said beside the field it is about. */
  error?: string | null;
  /**
   * The verdict has been given — by this reviewer or, in a conflict, by a colleague. The
   * text stays legible and selectable, because copying it out is the point (criterion 24).
   */
  readOnly?: boolean;
  /** Present on the per-sentence form, absent on the one attached to the whole work. */
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
}

/**
 * Where a teacher writes to a learner — with the alphabet they are writing in.
 *
 * The æøå pad is not a nicety here: the comment is written in Norwegian, to a learner
 * being corrected on Norwegian, and a teacher whose laptop cannot type "å" would be
 * explaining "får" while writing "far". The pad writes into whatever field has focus, so
 * one of these serves the box it sits under without being wired to it.
 *
 * Two shapes, one component. The comment on the whole work is controlled by the panel and
 * saves with the verdict; the comment on one sentence saves and clears on its own, which
 * is what `onSave` / `onCancel` turn on.
 */
export function CommentBox({
  label,
  placeholder,
  value,
  onChange,
  rows = 3,
  className,
  maxLength,
  inputRef,
  error = null,
  readOnly = false,
  onSave,
  onCancel,
  saveLabel,
}: CommentBoxProps) {
  const t = useTranslations('Review.submission.comment');
  const id = useId();

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Textarea
        id={id}
        ref={inputRef}
        rows={rows}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        maxLength={maxLength}
        hasError={error !== null}
        aria-invalid={error !== null}
        aria-errormessage={error === null ? undefined : `${id}-error`}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[11px] leading-relaxed"
        style={{ fontFamily: 'var(--ssz-font-reading)', fontSize: 14.5 }}
      />
      {error === null ? null : (
        <p id={`${id}-error`} role="alert" className="text-[12.5px] font-semibold text-error">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        {readOnly ? null : <CharPad chars={NORWEGIAN_CHARS} label={t('charPad')} />}
        {onSave === undefined ? null : (
          <>
            <span className="flex-1" />
            {onCancel === undefined ? null : (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                {t('cancel')}
              </Button>
            )}
            <Button type="button" size="sm" disabled={value.trim() === ''} onClick={onSave}>
              {saveLabel ?? t('save')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A comment already left on a sentence, with the one thing left to do to it: take it off.
 *
 * Shown rather than folded back into a link, because a teacher scanning a submission
 * before sending it back has to see what they have already said without opening anything.
 */
export function SavedComment({
  text,
  onEdit,
  onRemove,
}: {
  text: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('Review.submission.comment');

  return (
    <div className="flex items-start gap-2 rounded-[9px] border-[1.5px] border-border bg-(--ssz-bg-subtle) px-3 py-2">
      <p
        className="min-w-0 flex-1 whitespace-pre-wrap text-[13.5px] leading-relaxed"
        style={{ fontFamily: 'var(--ssz-font-reading)' }}
      >
        {text}
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
        {t('edit')}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        {t('remove')}
      </Button>
    </div>
  );
}

/** The per-sentence form: a link until it is wanted, then a box, then what was saved. */
export function SentenceComment({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const t = useTranslations('Review.submission.comment');
  // `null` is "the form is not open"; an empty string is an open, empty form.
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null) {
    return (
      <CommentBox
        label={t('sentenceLabel')}
        placeholder={t('sentencePlaceholder')}
        value={draft}
        rows={2}
        maxLength={SENTENCE_COMMENT_MAX}
        onChange={setDraft}
        onCancel={() => setDraft(null)}
        onSave={() => {
          onChange(draft.trim() === '' ? undefined : draft.trim());
          setDraft(null);
        }}
      />
    );
  }

  if (value !== undefined) {
    return (
      <SavedComment
        text={value}
        onEdit={() => setDraft(value)}
        onRemove={() => onChange(undefined)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setDraft('')}
      className="self-start text-[12.5px] font-semibold text-(--ssz-text-accent) underline-offset-2 hover:underline"
    >
      {t('addToSentence')}
    </button>
  );
}
