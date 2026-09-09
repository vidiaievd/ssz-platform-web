'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, ChevronDown, ChevronUp, ClipboardPaste, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  core,
  gapKey,
  gaps,
  issues,
  tokens,
  type Sentence,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';
import { withSegment, type AudioDraft, type ItemAudio } from '@/lib/shared-kernel/audio';

import { AudioSegmentField } from '../audio';
import {
  addSentence,
  addSentences,
  applySentenceText,
  emptySentence,
  explanationCount,
  moveSentence,
  removeSentence,
  sentenceExplanationCount,
  sentencesFromPaste,
  setSentenceHint,
  toggleGap,
} from './edits';

/** The reading face the student sees, so the teacher writes in it too. */
const READING = 'var(--ssz-font-reading)';

export interface StepSentencesProps {
  exercise: WordBankGapFill;
  onChange: (next: WordBankGapFill) => void;
  /**
   * The listening layer, held beside the document by the builder (plan 56 phase 5). Only
   * the timecodes are edited here — the switch and the clip are in the card above.
   */
  audio: AudioDraft;
  onAudioChange: (next: AudioDraft) => void;
  disabled?: boolean;
}

/**
 * Step 1 of the gap-fill builder: the sentences, written solved, and the words that
 * become gaps.
 *
 * Controlled and presentational — it takes a document and hands back a document. The
 * shell (autosave, the step rail, the pre-assign gate) owns everything else, and the
 * derived model comes from the kernel: this screen never decides what a gap's answer is,
 * what its label is, or whether the exercise is valid.
 *
 * The one thing it does own is the warning before a destructive edit. Un-gapping a token
 * takes its explanations with it, and unlike the coverage meter that text does not come
 * back, so the teacher is told the count first.
 */
export function StepSentences({
  exercise,
  onChange,
  audio,
  onAudioChange,
  disabled = false,
}: StepSentencesProps) {
  const t = useTranslations('Authoring');
  const allGaps = gaps(exercise);
  const problems = issues(exercise);

  /** Sentences the teacher has actually been in. A card added a second ago is not "empty", it is new. */
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [pasteText, setPasteText] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRemoval | null>(null);

  const inputs = useRef(new Map<string, HTMLInputElement | null>());
  const addButton = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef<string | null>(null);

  /**
   * Focus follows the edit: into a sentence just added (AC-B6), and onto the card that
   * took the place of a deleted one. It waits for the list to re-render, and it is a ref
   * rather than state because where the focus goes is not something to render — and
   * because `autoFocus` would only cover the first case, on a card that has just mounted.
   */
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    inputs.current.get(id)?.focus();
  }, [exercise.sentences]);

  function labelsOf(sentenceId: string): string[] {
    return allGaps.filter((gap) => gap.sentenceId === sentenceId).map((gap) => gap.label);
  }

  function handleAdd() {
    const sentence = emptySentence();
    pendingFocus.current = sentence.id;
    onChange(addSentence(exercise, sentence));
  }

  function handlePaste() {
    if (pasteText === null) return;
    const added = sentencesFromPaste(pasteText);
    if (added.length > 0) onChange(addSentences(exercise, added));
    setPasteText(null);
  }

  /**
   * Focus after a delete goes to the card that took its place, and to `Add sentence`
   * when the list is now empty — never nowhere, which is where the browser would put it.
   */
  function focusAfterRemoval(index: number) {
    const next = exercise.sentences[index + 1] ?? exercise.sentences[index - 1];
    if (next === undefined) {
      addButton.current?.focus();
      return;
    }
    pendingFocus.current = next.id;
  }

  function requestGapToggle(sentence: Sentence, tokenIndex: number) {
    const isGap = sentence.gaps.includes(tokenIndex);
    const cost = isGap ? explanationCount(exercise, gapKey(sentence.id, tokenIndex)) : 0;

    if (cost > 0) {
      setPending({ kind: 'gap', sentenceId: sentence.id, tokenIndex, count: cost });
      return;
    }
    onChange(toggleGap(exercise, sentence.id, tokenIndex));
  }

  function requestSentenceRemoval(sentence: Sentence, index: number) {
    const cost = sentenceExplanationCount(exercise, sentence.id);
    if (cost > 0) {
      setPending({ kind: 'sentence', sentenceId: sentence.id, index, count: cost });
      return;
    }
    onChange(removeSentence(exercise, sentence.id));
    focusAfterRemoval(index);
  }

  function confirmRemoval() {
    if (pending === null) return;
    if (pending.kind === 'gap') {
      onChange(toggleGap(exercise, pending.sentenceId, pending.tokenIndex));
    } else {
      onChange(removeSentence(exercise, pending.sentenceId));
      focusAfterRemoval(pending.index);
    }
    setPending(null);
  }

  const pasteCount = pasteText === null ? 0 : sentencesFromPaste(pasteText).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">{t('gapFill.step1.title')}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t('gapFill.step1.lede')}</p>
      </div>

      <div className="rounded-lg border border-border bg-[var(--ssz-bg-subtle)] px-4 py-3 text-sm">
        <p className="font-medium">{t('gapFill.step1.tipTitle')}</p>
        <p className="mt-0.5 text-muted-foreground">
          {t('gapFill.step1.tipBody')}{' '}
          <kbd
            className="rounded-sm border border-border px-1 py-0.5 text-xs"
            style={{ fontFamily: READING }}
          >
            {t('gapFill.step1.tipExample')}
          </kbd>
        </p>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('gapFill.step1.sentencesLabel')}</p>
          <p className="text-xs text-muted-foreground">
            {t('gapFill.step1.summary', {
              sentences: exercise.sentences.length,
              gaps: allGaps.length,
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => setPasteText('')}
        >
          <ClipboardPaste className="size-4" aria-hidden />
          {t('gapFill.step1.pasteSeveral')}
        </Button>
      </div>

      {exercise.sentences.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium">{t('gapFill.step1.emptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {t('gapFill.step1.emptyBody')}
          </p>
          <Button type="button" className="mt-4" disabled={disabled} onClick={handleAdd}>
            <Plus className="size-4" aria-hidden />
            {t('gapFill.step1.addSentence')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exercise.sentences.map((sentence, index) => (
            <SentenceCard
              key={sentence.id}
              sentence={sentence}
              index={index}
              labels={labelsOf(sentence.id)}
              segment={
                audio.audio.enabled && audio.audio.useSegments
                  ? (audio.segments[sentence.id] ?? null)
                  : undefined
              }
              onSegmentChange={(segment) => onAudioChange(withSegment(audio, sentence.id, segment))}
              // A blank card the teacher has not been in yet is not an error to them.
              showEmptyError={
                touched.has(sentence.id) &&
                problems.some(
                  (issue) => issue.code === 'SENT_EMPTY' && issue.sentenceId === sentence.id,
                )
              }
              showNoGapError={problems.some(
                (issue) => issue.code === 'SENT_NO_GAP' && issue.sentenceId === sentence.id,
              )}
              disabled={disabled}
              canMoveUp={index > 0}
              canMoveDown={index < exercise.sentences.length - 1}
              registerInput={(el) => inputs.current.set(sentence.id, el)}
              onTextChange={(text) => {
                setTouched((current) => new Set(current).add(sentence.id));
                onChange(applySentenceText(exercise, sentence.id, text));
              }}
              onHintChange={(hint) => onChange(setSentenceHint(exercise, sentence.id, hint))}
              onToggleGap={(tokenIndex) => requestGapToggle(sentence, tokenIndex)}
              onMove={(direction) => onChange(moveSentence(exercise, index, direction))}
              onDelete={() => requestSentenceRemoval(sentence, index)}
            />
          ))}

          <div>
            <Button
              type="button"
              variant="ghost"
              ref={addButton}
              disabled={disabled}
              onClick={handleAdd}
            >
              <Plus className="size-4" aria-hidden />
              {t('gapFill.step1.addSentence')}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={pasteText !== null} onOpenChange={(open) => !open && setPasteText(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('gapFill.step1.pasteTitle')}</DialogTitle>
            <DialogDescription>{t('gapFill.step1.pasteHelp')}</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={8}
            value={pasteText ?? ''}
            aria-label={t('gapFill.step1.pasteTitle')}
            placeholder={t('gapFill.step1.pastePlaceholder')}
            style={{ fontFamily: READING }}
            onChange={(event) => setPasteText(event.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPasteText(null)}>
              {t('gapFill.step1.cancel')}
            </Button>
            <Button type="button" disabled={pasteCount === 0} onClick={handlePaste}>
              {t('gapFill.step1.pasteAdd', { count: pasteCount })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === 'sentence'
                ? t('gapFill.step1.removeSentenceTitle')
                : t('gapFill.step1.removeGapTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('gapFill.step1.removeExplanations', { count: pending?.count ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('gapFill.step1.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoval}>
              {t('gapFill.step1.removeConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** What the teacher asked to remove, held until they confirm losing the explanations. */
type PendingRemoval =
  | { kind: 'gap'; sentenceId: string; tokenIndex: number; count: number }
  | { kind: 'sentence'; sentenceId: string; index: number; count: number };

interface SentenceCardProps {
  sentence: Sentence;
  index: number;
  labels: string[];
  /**
   * The slice of the clip this sentence is heard in, or `undefined` when there are no
   * timecodes to write — no audio, or the author has not asked for per-item ones.
   */
  segment?: ItemAudio | null;
  onSegmentChange: (segment: ItemAudio | null) => void;
  showEmptyError: boolean;
  showNoGapError: boolean;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  registerInput: (el: HTMLInputElement | null) => void;
  onTextChange: (text: string) => void;
  onHintChange: (hint: string) => void;
  onToggleGap: (tokenIndex: number) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}

function SentenceCard({
  sentence,
  index,
  labels,
  segment,
  onSegmentChange,
  showEmptyError,
  showNoGapError,
  disabled,
  canMoveUp,
  canMoveDown,
  registerInput,
  onTextChange,
  onHintChange,
  onToggleGap,
  onMove,
  onDelete,
}: SentenceCardProps) {
  const t = useTranslations('Authoring');
  const [showHint, setShowHint] = useState(sentence.hint !== undefined && sentence.hint !== '');
  const sentenceTokens = tokens(sentence.text);
  const gapIndices = [...sentence.gaps].sort((a, b) => a - b);
  const hasError = showEmptyError || showNoGapError;

  /** `G2` for the token, by its position among this sentence's gaps — never stored. */
  function labelOf(tokenIndex: number): string | null {
    const at = gapIndices.indexOf(tokenIndex);
    return at === -1 ? null : (labels[at] ?? null);
  }

  return (
    <div className={`rounded-lg border bg-surface ${hasError ? 'border-error' : 'border-border'}`}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
        <span className="text-xs text-muted-foreground">
          {labels.length === 0
            ? t('gapFill.step1.noGapYet')
            : t('gapFill.step1.gapSummary', { count: labels.length, labels: labels.join(', ') })}
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || !canMoveUp}
          aria-label={t('gapFill.step1.moveUp')}
          onClick={() => onMove(-1)}
        >
          <ChevronUp className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || !canMoveDown}
          aria-label={t('gapFill.step1.moveDown')}
          onClick={() => onMove(1)}
        >
          <ChevronDown className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label={t('gapFill.step1.deleteSentence')}
          onClick={onDelete}
        >
          <Trash2 className="size-4 text-error" aria-hidden />
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <Input
          ref={registerInput}
          value={sentence.text}
          disabled={disabled}
          hasError={hasError}
          aria-invalid={hasError}
          aria-label={t('gapFill.step1.sentenceLabel', { index: index + 1 })}
          placeholder={t('gapFill.step1.sentencePlaceholder')}
          style={{ fontFamily: READING }}
          onChange={(event) => onTextChange(event.target.value)}
        />

        {sentenceTokens.length > 0 && (
          <div>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={t('gapFill.step1.tokensLabel')}
            >
              {sentenceTokens.map((token, tokenIndex) => {
                const label = labelOf(tokenIndex);
                const isGap = label !== null;
                return (
                  <button
                    key={tokenIndex}
                    type="button"
                    disabled={disabled}
                    aria-pressed={isGap}
                    title={isGap ? t('gapFill.step1.tokenUnGap') : t('gapFill.step1.tokenMakeGap')}
                    onClick={() => onToggleGap(tokenIndex)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:shadow-focus-primary disabled:opacity-50 ${
                      isGap
                        ? 'border-primary bg-primary text-white'
                        : 'border-border text-[var(--ssz-text-secondary)] hover:bg-[var(--ssz-bg-subtle)]'
                    }`}
                    style={{ fontFamily: READING }}
                  >
                    {isGap ? core(token) : token}
                    {label !== null && <span className="text-[11px] font-semibold">{label}</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {labels.length === 0
                ? t('gapFill.step1.tokensHelpMark')
                : t('gapFill.step1.tokensHelpRemove')}
            </p>
          </div>
        )}

        {/* A sentence read out of one clip is the dictation case this type is written
            for, and the timecode is what makes each line its own to hear. */}
        {segment !== undefined && (
          <AudioSegmentField segment={segment} onChange={onSegmentChange} />
        )}

        {showEmptyError && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-error">
            <AlertCircle className="size-3.5" aria-hidden />
            {t('gapFill.step1.errorEmpty')}
          </p>
        )}
        {showNoGapError && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-error">
            <AlertCircle className="size-3.5" aria-hidden />
            {t('gapFill.step1.errorNoGap')}
          </p>
        )}

        {showHint ? (
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`hint-${sentence.id}`}
            >
              {t('gapFill.step1.hintLabel')}
            </label>
            <Input
              id={`hint-${sentence.id}`}
              value={sentence.hint ?? ''}
              disabled={disabled}
              placeholder={t('gapFill.step1.hintPlaceholder')}
              onChange={(event) => onHintChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('gapFill.step1.hintHelp')}</p>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="link"
              size="sm"
              disabled={disabled}
              onClick={() => setShowHint(true)}
            >
              <Plus className="size-3.5" aria-hidden />
              {t('gapFill.step1.addHint')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
