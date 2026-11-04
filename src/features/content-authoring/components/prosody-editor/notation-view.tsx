'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { NotationIssue, ProsodyLayer } from '@/lib/shared-kernel/prosody';

import { issueOffset, lineAndColumn, readNotation, writeLayer } from './notation-edit';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;

export interface NotationViewProps {
  text: string;
  layer: ProsodyLayer;
  onChange: (layer: ProsodyLayer) => void;
  lang?: string;
  /** Where the words themselves are edited — what a text mismatch sends the author to. */
  textIn?: TextIn;
}

/** The builder's step 1, or the body field of the lesson editor. */
export type TextIn = 'step1' | 'lessonBody';

/**
 * The marks «As text» (plan 86, §4i.3, step 6h.3c): the passage with the author's marks written
 * in it, as Bonk writes them and as seeds and course Markdown carry them. A typed change that
 * reads back as the passage goes to the owner at once, like an edit «Visually»; one that does
 * not stays in the field with the place it went wrong, and nothing is applied.
 *
 * The field is the author's while they type: a layer coming back from the owner (the saved
 * one) replaces it only when it means something else than what the field last applied.
 */
export function NotationView({ text, layer, onChange, lang, textIn = 'step1' }: NotationViewProps) {
  const t = useTranslations('Authoring.prosodyEditor');
  const hintId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const written = writeLayer(text, layer);
  const [draft, setDraft] = useState(written.notation);
  const [issues, setIssues] = useState<NotationIssue[]>([]);
  /** What the field last applied, written — a layer saying the same leaves the field alone. */
  const [applied, setApplied] = useState(written.notation);
  const [basis, setBasis] = useState({ text, layer });

  // A layer from elsewhere (the other view, the saved answer, an accepted suggestion).
  if (basis.text !== text || basis.layer !== layer) {
    setBasis({ text, layer });
    if (written.notation !== applied || basis.text !== text) {
      setDraft(written.notation);
      setApplied(written.notation);
      setIssues([]);
    }
  }

  const type = (next: string) => {
    setDraft(next);
    const read = readNotation(text, next, layer);
    if (read.status === 'invalid') {
      setIssues(read.issues);
      return;
    }
    setIssues([]);
    setApplied(writeLayer(text, read.layer).notation);
    onChange(read.layer);
  };

  const show = (at: number) => {
    const el = field.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(at, Math.min(draft.length, at + 1));
  };

  const issue = issues[0];
  const at = issue ? issueOffset(issue) : null;
  const place = at === null ? null : lineAndColumn(draft, at);

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={field}
        lang={lang}
        value={draft}
        spellCheck={false}
        aria-label={t('notationLabel')}
        aria-describedby={hintId}
        aria-invalid={issue !== undefined}
        onChange={(event) => type(event.target.value)}
        rows={Math.min(12, Math.max(3, draft.split('\n').length + 1))}
        className="w-full resize-y rounded-(--ssz-radius-sm) border border-(--ssz-border-default) bg-(--ssz-bg-surface) p-3 text-lg leading-relaxed aria-invalid:border-(--ssz-color-error-600) focus-visible:outline-2 focus-visible:outline-(--ssz-color-primary-600)"
        style={READING}
      />
      {issue !== undefined && (
        <p
          role="alert"
          className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm text-(--ssz-color-error-700)"
        >
          <span>
            {place !== null && `${t('notationAt', place)} `}
            <NotationIssueText issue={issue} text={text} textIn={textIn} />
          </span>
          {at !== null && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => show(at)}
            >
              {t('notationShow')}
            </Button>
          )}
        </p>
      )}
      <p id={hintId} className="m-0 text-xs text-(--ssz-text-muted)">
        {t('notationHint')}
      </p>
      {written.kept.length > 0 && (
        <p className="m-0 text-xs text-(--ssz-text-muted)">
          {t('notationKept', { count: written.kept.length })}
        </p>
      )}
    </div>
  );
}

function NotationIssueText({
  issue,
  text,
  textIn,
}: {
  issue: NotationIssue;
  text: string;
  textIn: TextIn;
}) {
  const t = useTranslations('Authoring.prosodyEditor');
  switch (issue.code) {
    case 'PN_MARKER_NO_WORD':
      return <>{t('PN_MARKER_NO_WORD', { marker: issue.marker })}</>;
    case 'PN_MARKER_AT_LINE_START':
      return <>{t('PN_MARKER_AT_LINE_START', { marker: issue.marker })}</>;
    case 'PN_LINK_AT_END':
      return <>{t('PN_LINK_AT_END')}</>;
    case 'PN_STRESS_NO_VOWEL':
      return <>{t('PN_STRESS_NO_VOWEL', { word: issue.word })}</>;
    case 'PN_DUPLICATE':
      return <>{t('PN_DUPLICATE')}</>;
    case 'PN_LINK_WITH_BOUNDARY':
      return <>{t('PN_LINK_WITH_BOUNDARY')}</>;
    case 'PN_TEXT_MISMATCH': {
      const from = text.slice(issue.textAt, issue.textAt + 24).split('\n')[0] ?? '';
      const args = { from: from === '' ? '…' : from };
      return (
        <>
          {textIn === 'lessonBody'
            ? t('PN_TEXT_MISMATCH_LESSON', args)
            : t('PN_TEXT_MISMATCH', args)}
        </>
      );
    }
  }
}
