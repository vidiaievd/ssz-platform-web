'use client';

import { useEffect, useState, useTransition, type RefObject } from 'react';
import { TextSelect } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Container, LessonSpanKind } from '@/features/content/types';

import { bodyRangeToSpan, type SpanSelectionError } from '../lib/span-coordinates';
import { splitParagraphs } from '../lib/split-paragraphs';
import { createTextSpanAction } from '../actions/lesson-spans';
import { useAuthoringVocabularyLists, useAuthoringVocabularyItems } from '../api/use-authoring-vocabulary';
import { useAuthoringGrammarRules } from '../api/use-authoring-grammar';
import { authoringKeys } from '../api/keys';

const KINDS: LessonSpanKind[] = ['vocab', 'grammar', 'chunk'];

const SELECTION_ERROR_KEY = {
  empty: 'spans.errorEmpty',
  'crosses-paragraph': 'spans.errorCrossesParagraph',
  'too-long': 'spans.errorTooLong',
} as const satisfies Record<SpanSelectionError, string>;

interface TextSpanMenuProps {
  lessonId: string;
  /** Undefined until the anchor text has been saved at least once (no variant yet). */
  variantId: string | undefined;
  /** The module the lesson belongs to — vocabulary list and grammar rules come from it. */
  container: Container;
  /** Current body markdown. Span offsets are into this, so it must be the live form value. */
  body: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * Reads the body textarea's selection as the author moves it.
 *
 * `selectionchange` is the only event that catches every way a selection can
 * change — drag, shift-arrow, double-click, select-all — and it fires on the
 * document rather than on the field, so it is filtered by target here.
 */
function useTextareaSelection(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  body: string,
) {
  const [range, setRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [syncedBody, setSyncedBody] = useState(body);

  useEffect(() => {
    function read() {
      const el = textareaRef.current;
      if (!el || document.activeElement !== el) return;
      setRange({ start: el.selectionStart, end: el.selectionEnd });
    }

    document.addEventListener('selectionchange', read);
    return () => document.removeEventListener('selectionchange', read);
  }, [textareaRef]);

  // Editing the body invalidates the offsets: the same numbers now point at
  // different text. Dropping the range disables the trigger until the author
  // selects again, rather than letting them annotate a stretch they never
  // picked. Adjusted during render rather than in an effect — React's own
  // "reset state when a prop changes" pattern, which avoids rendering one frame
  // with the stale selection still live.
  if (syncedBody !== body) {
    setSyncedBody(body);
    setRange({ start: 0, end: 0 });
  }

  return range;
}

/**
 * Header action for the anchor-text card: turns the current body selection into
 * a lexis / grammar / chunk annotation (spec 16).
 *
 * The affordance deliberately lives in the header rather than floating at the
 * caret. A textarea selection has no DOM Range, so a caret-anchored popup would
 * need a mirrored-styles measurement div; and a popover that opened by itself on
 * every selection would steal focus from an author who was only selecting text
 * in order to retype it. `MarkdownFormatMenu` already operates on the selection
 * from this same header, so the interaction is one the author has met.
 */
export function TextSpanMenu({
  lessonId,
  variantId,
  container,
  body,
  textareaRef,
}: TextSpanMenuProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<LessonSpanKind>('vocab');
  const [refId, setRefId] = useState('');
  const [note, setNote] = useState('');

  const selection = useTextareaSelection(textareaRef, body);
  const coordinates = bodyRangeToSpan(body, selection.start, selection.end);
  // Frozen while the popover is open: the author's focus has moved into it, so
  // the field's selection is no longer what they are annotating.
  const [pinned, setPinned] = useState<typeof coordinates | null>(null);
  const active = pinned ?? coordinates;

  const { data: lists } = useAuthoringVocabularyLists(container.id);
  const list = lists?.[0];
  const { data: itemsPage } = useAuthoringVocabularyItems(list?.id ?? '', 1, !!list);
  const items = itemsPage?.items ?? [];
  const { data: rules } = useAuthoringGrammarRules(container.id, kind === 'grammar');

  function handleOpenChange(next: boolean) {
    setPinned(next ? coordinates : null);
    if (!next) {
      setRefId('');
      setNote('');
    }
    setOpen(next);
  }

  function handleCreate() {
    if (!variantId || !active.ok) return;
    if (kind !== 'chunk' && !refId) return;

    startTransition(async () => {
      const result = await createTextSpanAction(lessonId, variantId, {
        ...active.value,
        kind,
        refId: kind === 'chunk' ? undefined : refId,
        note: note.trim() || undefined,
      });

      if (!result.ok) {
        // An overlap is the one rejection the author can act on directly, and
        // the generic "conflict" wording would not tell them what to do.
        toast.error(
          result.error.code === 'conflict'
            ? t('spans.overlapError')
            : tErrors(result.error.code),
        );
        return;
      }

      handleOpenChange(false);
      toast.success(t('spans.createSuccess'));
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.lessonTextSpans(lessonId, variantId),
      });
      // A vocab span upserts the variant's glossary mark server-side, so the
      // marked-words caption below the field is stale until this refetches.
      if (kind === 'vocab') {
        await queryClient.invalidateQueries({
          queryKey: authoringKeys.lessonGlossaryMarks(lessonId, variantId),
        });
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {/*
          Disabled on the selection alone, not on the variant: an author who has
          typed a body but whose first autosave has not landed yet still has a
          usable selection, and needs to be told why it cannot be annotated
          rather than handed a dead button. Same shape as GlossaryMarkButton.
        */}
        <Button variant="ghost" size="sm" type="button" disabled={!coordinates.ok}>
          <TextSelect aria-hidden /> {t('spans.markSelection')}
        </Button>
      </PopoverTrigger>
      {/*
        Focus stays in the textarea so the browser keeps painting the selection —
        it stops painting it in an unfocused field, and there is no CSS for an
        inactive selection, so letting Radix move focus here would leave the
        author unable to see what they are annotating. The popover is still
        reachable by Tab and still closes on Esc.
      */}
      <PopoverContent
        align="end"
        className="w-80"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {!variantId ? (
          <p className="text-sm text-muted-foreground">{t('spans.needsBody')}</p>
        ) : !active.ok ? (
          <p className="text-sm text-muted-foreground">{t(SELECTION_ERROR_KEY[active.error])}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {t('spans.selected', { text: selectedText(body, active.value) })}
            </p>

            <div
              role="radiogroup"
              aria-label={t('spans.kind')}
              className="inline-flex gap-0.5 rounded-xl border border-(--ssz-border-default) bg-(--ssz-bg-subtle) p-0.75"
            >
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={k === kind}
                  onClick={() => {
                    setKind(k);
                    setRefId('');
                  }}
                  className={cn(
                    'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
                    k === kind
                      ? 'bg-surface text-(--ssz-color-primary-700) shadow-(--ssz-shadow-sm)'
                      : 'text-(--ssz-text-secondary)',
                  )}
                >
                  {t(KIND_LABEL[k])}
                </button>
              ))}
            </div>

            {kind === 'vocab' &&
              (!list ? (
                <p className="text-sm text-muted-foreground">{t('spans.noList')}</p>
              ) : (
                <Select value={refId} onValueChange={setRefId} disabled={items.length === 0}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('spans.pickWord')} />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.lemma}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}

            {kind === 'grammar' &&
              ((rules ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('spans.noRules')}</p>
              ) : (
                <Select value={refId} onValueChange={setRefId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('spans.pickRule')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(rules ?? []).map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}

            <Field label={t('spans.noteLabel')} htmlFor="span-note">
              <Input
                id="span-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('spans.notePlaceholder')}
                maxLength={500}
              />
            </Field>

            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={isPending || (kind !== 'chunk' && !refId)}
              loading={isPending}
            >
              {t('spans.create')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const KIND_LABEL = {
  vocab: 'spans.kindVocab',
  grammar: 'spans.kindGrammar',
  chunk: 'spans.kindChunk',
} as const satisfies Record<LessonSpanKind, string>;

/**
 * The text the service will store as the span's snapshot — resolved through the
 * paragraph split rather than sliced straight out of the body, so what the
 * author is shown is what the anchor will actually hold.
 */
function selectedText(
  body: string,
  span: { paragraphIndex: number; charStart: number; charEnd: number },
) {
  const paragraph = splitParagraphs(body)[span.paragraphIndex] ?? '';
  return paragraph.slice(span.charStart, span.charEnd);
}
