'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Headphones, List, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  contrastsOf,
  exerciseContrast,
  filledWords,
  issues,
  MAX_WORDS,
  MIN_WORDS,
  packFor,
  pairContrast,
  probePool,
  type ContrastFamily,
  type Issue,
} from '@/lib/shared-kernel/minimal-pairs';

import { Notes, type Note } from '../dictation/notes';
import { Callout, Card, Field, StepHead } from '../highlight-in-text/parts';
import {
  addPair,
  addWord,
  removePair,
  removeWord,
  setContrast,
  setInstruction,
  setPairContrast,
  setPairNote,
  setTitle,
  setWord,
  type DocumentUpdate,
  type MinimalPairsDocument,
} from './edits';
import { useIssueCopy } from './issue-copy';
import { LibraryDialog } from './library-dialog';
import {
  DELETE,
  FAMILY_ICONS,
  MONO,
  PairCard,
  READING,
  SectionHead,
  Side,
  sideOf,
  TtsChip,
} from './parts';

/** Findings of step 1 that belong to a pair, drawn in its card. */
const PAIR_CODES = new Set<Issue['code']>([
  'MP_PAIR_UNDER_TWO',
  'MP_PAIR_DUPLICATE',
  'MP_GROUP_TOO_LARGE',
  'MP_NO_GLOSS',
]);

const ROW =
  'grid items-center gap-2 grid-cols-[22px_minmax(0,1.1fr)_minmax(0,1.3fr)_110px_30px] @max-[560px]:grid-cols-[22px_minmax(0,1fr)_minmax(0,1fr)_30px]';

export interface StepPairsProps {
  exercise: MinimalPairsDocument;
  onChange: DocumentUpdate;
}

/**
 * Step 1: the contrast and the pairs (plan 72 §7.2, MP-B1…B8).
 *
 * The family grid is the language pack's: a course in a language without one gets a notice in
 * its place, not Norwegian families. What a family means for the author — its description and
 * the note under the grid — is translated; its label and IPA are the pack's, because the student
 * sees them. Every limit (one pair at least, two or three words) is the kernel's; the buttons
 * only mirror it.
 */
export function StepPairs({ exercise, onChange }: StepPairsProps) {
  const t = useTranslations('Authoring.minimalPairs');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const copy = useIssueCopy(exercise);

  const families = contrastsOf(exercise.language);
  const family = exerciseContrast(exercise);
  const placeholders = packFor(exercise.language)?.placeholders;
  const found = issues(exercise).filter((issue) => issue.step === 1);

  const noteOf = (issue: Issue, index: number): Note => ({
    key: `${issue.code}-${index}`,
    level: issue.level,
    text: copy.describe(issue),
  });
  const stepNotes = found
    .filter((issue) => !PAIR_CODES.has(issue.code))
    // Without a pack the grid's own notice says it; the list would only repeat it.
    .filter((issue) => issue.code !== 'MP_NO_CONTRAST' || families.length > 0)
    .map(noteOf);

  const pairs = exercise.pairs.length;

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('step1.eyebrow')} title={t('step1.title')} lede={t('step1.lede')} />

      <Card>
        <Field label={t('step1.titleLabel')} htmlFor="mp-title" required>
          <Input
            id="mp-title"
            value={exercise.title}
            placeholder={placeholders?.title ?? ''}
            onChange={(event) => onChange(setTitle(exercise, event.target.value))}
          />
        </Field>

        <Field
          label={t('step1.contrastLabel')}
          message={{ tone: 'hint', text: t('step1.contrastHint'), id: 'mp-contrast-help' }}
        >
          {families.length === 0 ? (
            <Callout tone="warn">{t('step1.noPack', { language: exercise.language })}</Callout>
          ) : (
            <div
              role="group"
              aria-label={t('step1.contrastLabel')}
              aria-describedby="mp-contrast-help"
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))' }}
            >
              {families.map((c) => (
                <FamilyButton
                  key={c.id}
                  family={c}
                  language={exercise.language}
                  pressed={exercise.contrastId === c.id}
                  onPress={() => onChange(setContrast(exercise, c.id))}
                />
              ))}
            </div>
          )}
        </Field>

        {family !== undefined && (
          <Callout tone={family.tts === 'no' ? 'warn' : 'tip'} icon={Headphones}>
            <b>{family.label}.</b>{' '}
            <FamilyText family={family} language={exercise.language} part="note" />
          </Callout>
        )}

        <Field
          label={t('step1.instructionLabel')}
          htmlFor="mp-instruction"
          message={{ tone: 'hint', text: t('step1.instructionHint'), id: 'mp-instruction-help' }}
        >
          <Input
            id="mp-instruction"
            aria-describedby="mp-instruction-help"
            style={READING}
            value={exercise.instruction}
            placeholder={placeholders?.instruction ?? ''}
            onChange={(event) => onChange(setInstruction(exercise, event.target.value))}
          />
        </Field>
      </Card>

      <SectionHead
        eyebrow={t('step1.pairsEyebrow')}
        title={t('step1.pairsCount', { pairs, words: probePool(exercise) })}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={family === undefined}
          onClick={() => setLibraryOpen(true)}
        >
          <List className="size-4" aria-hidden />
          {t('step1.fromLibrary')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(addPair(exercise))}
        >
          <Plus className="size-4" aria-hidden />
          {t('step1.addPair')}
        </Button>
      </SectionHead>

      <Notes notes={stepNotes} />

      {exercise.pairs.map((pair, index) => {
        const name = copy.pairName(pair.id);
        const filled = filledWords(pair);
        const own = pairContrast(exercise, pair);
        const other = pair.contrastId !== '' && pair.contrastId !== exercise.contrastId;
        const notes = found
          .filter(
            (issue) => 'pairId' in issue && issue.pairId === pair.id && PAIR_CODES.has(issue.code),
          )
          .map(noteOf);
        return (
          <PairCard
            key={pair.id}
            index={index}
            title={filled.map((w) => w.text).join(' · ') || t('step1.newPair')}
            bad={filled.length < MIN_WORDS}
            head={
              <>
                {other && own !== undefined && (
                  <span
                    title={t('step1.otherContrast')}
                    className="inline-flex items-center rounded-full border border-(--ssz-border-strong) bg-(--ssz-bg-subtle) px-2.5 py-[3px] text-xs font-medium"
                  >
                    {own.label}
                  </span>
                )}
                <span className="flex-1" />
                <span className="text-[11px] text-(--ssz-text-muted)" style={MONO}>
                  {pair.id}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={DELETE}
                  disabled={pairs < 2}
                  aria-label={`${t('step1.deletePair')} — ${name}`}
                  onClick={() => onChange(removePair(exercise, pair.id))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-3 @container">
              <div
                aria-hidden="true"
                className={`${ROW} pl-[30px] text-[10px] tracking-wide text-(--ssz-text-muted) uppercase`}
              >
                <span className="hidden" />
                <span>{t('step1.colWord')}</span>
                <span>{t('step1.colGloss')}</span>
                <span className="@max-[560px]:hidden">{t('step1.colIpa')}</span>
                <span />
              </div>
              {pair.words.map((word, wi) => {
                const at = { side: sideOf(wi), pair: name };
                return (
                  <div key={word.id} className={ROW}>
                    <Side index={wi} />
                    <Input
                      aria-label={t('step1.word', at)}
                      style={READING}
                      value={word.text}
                      placeholder={placeholders?.words[wi === 0 ? 0 : 1] ?? ''}
                      onChange={(event) =>
                        onChange(setWord(exercise, pair.id, word.id, { text: event.target.value }))
                      }
                    />
                    <Input
                      aria-label={t('step1.gloss', at)}
                      value={word.gloss}
                      placeholder={placeholders?.gloss ?? ''}
                      onChange={(event) =>
                        onChange(setWord(exercise, pair.id, word.id, { gloss: event.target.value }))
                      }
                    />
                    <Input
                      aria-label={t('step1.ipa', at)}
                      className="max-w-[110px] text-xs @max-[560px]:hidden"
                      style={MONO}
                      value={word.ipa}
                      placeholder={placeholders?.ipa ?? ''}
                      onChange={(event) =>
                        onChange(setWord(exercise, pair.id, word.id, { ipa: event.target.value }))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={DELETE}
                      disabled={pair.words.length <= MIN_WORDS}
                      aria-label={t('step1.removeWord', at)}
                      onClick={() => onChange(removeWord(exercise, pair.id, word.id))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pair.words.length >= MAX_WORDS}
                onClick={() => onChange(addWord(exercise, pair.id))}
              >
                <Plus className="size-4" aria-hidden />
                {t('step1.thirdWord')}
              </Button>
              <span className="flex-1" />
              {families.length > 0 && (
                <Segmented
                  size="sm"
                  aria-label={t('step1.pairContrast', { pair: name })}
                  value={pair.contrastId === '' ? exercise.contrastId : pair.contrastId}
                  onValueChange={(value) => onChange(setPairContrast(exercise, pair.id, value))}
                  options={families.map((c) => ({ value: c.id, label: c.label }))}
                />
              )}
            </div>

            <Field
              label={t('step1.noteLabel')}
              htmlFor={`mp-note-${pair.id}`}
              message={{ tone: 'hint', text: t('step1.noteHint'), id: `mp-note-${pair.id}-help` }}
            >
              <Input
                id={`mp-note-${pair.id}`}
                aria-describedby={`mp-note-${pair.id}-help`}
                value={pair.note}
                placeholder={placeholders?.note ?? ''}
                onChange={(event) => onChange(setPairNote(exercise, pair.id, event.target.value))}
              />
            </Field>

            <Notes notes={notes} />
          </PairCard>
        );
      })}

      <LibraryDialog
        open={libraryOpen}
        exercise={exercise}
        onOpenChange={setLibraryOpen}
        onChange={onChange}
      />
    </div>
  );
}

/** `mp-fam`: one family of the pack — icon, label, IPA, what it is, its synthesis policy. */
function FamilyButton({
  family,
  language,
  pressed,
  onPress,
}: {
  family: ContrastFamily;
  language: string;
  pressed: boolean;
  onPress: () => void;
}) {
  const Icon = FAMILY_ICONS[family.icon];
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className={`flex flex-col items-start gap-1.5 rounded-(--ssz-radius-md) border px-3 py-[11px] text-left transition-colors duration-150 focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none ${
        pressed
          ? 'border-(--ssz-interactive-primary) bg-(--ssz-color-primary-50) shadow-[inset_0_0_0_1px_var(--ssz-interactive-primary)]'
          : 'border-(--ssz-border-default) bg-(--ssz-bg-surface) hover:border-(--ssz-border-strong) hover:bg-(--ssz-bg-subtle)'
      }`}
    >
      <span className="flex items-center gap-[7px] text-sm text-(--ssz-text-primary)">
        <Icon size={15} aria-hidden="true" />
        <b>{family.label}</b>
        <span className="text-[11px] text-(--ssz-text-muted)" style={MONO}>
          {family.ipa}
        </span>
      </span>
      <span
        className="text-xs leading-[1.45] text-(--ssz-text-secondary)"
        style={{ textWrap: 'pretty' }}
      >
        <FamilyText family={family} language={language} part="desc" />
      </span>
      <TtsChip tts={family.tts} />
    </button>
  );
}

/**
 * A family's explanation for the author, in the author's language (plan 72 §3.3, Q7-A). Keyed by
 * the pack's language and the family id; a pack without its texts yet shows nothing rather than
 * a key.
 */
function FamilyText({
  family,
  language,
  part,
}: {
  family: ContrastFamily;
  language: string;
  part: 'desc' | 'note';
}) {
  const t = useTranslations('Authoring.minimalPairs.contrasts');
  const pack = packFor(language)?.language ?? language;
  const key = `${pack}.${family.id}.${part}` as 'nb.kjsj.desc';
  return t.has(key) ? <>{t(key)}</> : null;
}
