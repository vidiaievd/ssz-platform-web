'use client';

import { AlertTriangle, Check, Headphones, Info, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  audioIssuesOf,
  issues,
  packOf,
  packsFor,
  wordsIn,
  type FormatPack,
  type InfFocus,
  type InformationTransferContent,
  type SourceKind,
} from '@/lib/shared-kernel/information-transfer';

import { AudioSourceCard, AudioTranscriptCard, useAudioIssueCopy } from '../audio';
import { Notes, type Note } from '../dictation/notes';
import { Callout, Card, Field, StepHead } from '../highlight-in-text/parts';
import { READING } from '../minimal-pairs/parts';
import {
  audioDraftOf,
  setFocus,
  setInstruction,
  setLanguage,
  setPassage,
  setPassageTitle,
  setSourceKind,
  setTitle,
  withAudioDraft,
} from './edits';
import { isSourceOrForm, useIssueCopy } from './issue-copy';

export interface StepSourceProps<T extends InformationTransferContent> {
  exercise: T;
  onChange: (next: T) => void;
}

/**
 * Step 1: the source — a notice to read or an announcement to hear (plan 73 §7.2).
 *
 * One switch decides which, and it is the switch that moves the input axis: nothing else in
 * the exercise changes between the two. A text is typed here; a recording is the shared audio
 * layer's cards, and its transcript is not optional — every content check of step 2 reads it.
 *
 * What the issue list says is drawn where it is fixed: the missing text on the text card, the
 * missing transcript under the recording, the title and the pack under the first card.
 */
export function StepSource<T extends InformationTransferContent>({
  exercise,
  onChange,
}: StepSourceProps<T>) {
  const t = useTranslations('Authoring.informationTransfer.step1');
  const copy = useIssueCopy();
  const describeAudio = useAudioIssueCopy();
  const pack = packOf(exercise);
  const audio = exercise.sourceKind === 'audio';
  const hasTranscript = exercise.audio.transcript.trim() !== '';
  const missingText = !audio && exercise.passage.trim() === '';

  const own = issues(exercise).filter((issue) => issue.step === 1);
  const headNotes: Note[] = own
    .filter(isSourceOrForm)
    .filter(
      (issue) =>
        issue.code === 'INF_NO_TITLE' ||
        issue.code === 'INF_NO_INSTRUCTION' ||
        issue.code === 'INF_NO_PACK',
    )
    .map((issue) => ({ key: issue.code, level: issue.level, text: copy.describe(issue) }));
  const audioNotes = (part: 'source' | 'transcript'): Note[] =>
    audioIssuesOf(exercise)
      .filter((issue) => issue.part === part)
      .map((issue) => ({ key: issue.code, level: issue.level, text: describeAudio(issue) }));

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card>
        <Field label={t('titleLabel')} htmlFor="inf-title" required>
          <Input
            id="inf-title"
            value={exercise.title}
            placeholder={pack?.placeholders.title ?? ''}
            aria-required
            onChange={(event) => onChange(setTitle(exercise, event.target.value))}
          />
        </Field>
        <Field
          label={t('instructionLabel')}
          htmlFor="inf-instruction"
          message={{ tone: 'hint', text: t('instructionHelp'), id: 'inf-instruction-help' }}
        >
          <Input
            id="inf-instruction"
            aria-describedby="inf-instruction-help"
            className="text-base"
            style={READING}
            value={exercise.instruction}
            placeholder={pack?.placeholders.instruction ?? ''}
            onChange={(event) => onChange(setInstruction(exercise, event.target.value))}
          />
        </Field>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] items-start gap-x-2.5 gap-y-3">
          <Field
            label={t('sourceLabel')}
            message={{ tone: 'hint', text: t('sourceHelp'), id: 'inf-source-help' }}
          >
            <Segmented<SourceKind>
              aria-label={t('sourceLabel')}
              value={exercise.sourceKind}
              onValueChange={(next) => onChange(setSourceKind(exercise, next))}
              options={[
                { value: 'text', label: t('sourceText'), icon: Type },
                { value: 'audio', label: t('sourceAudio'), icon: Headphones },
              ]}
            />
          </Field>
          <Field
            label={t('focusLabel')}
            message={{ tone: 'hint', text: t('focusHelp'), id: 'inf-focus-help' }}
          >
            <Segmented<InfFocus>
              aria-label={t('focusLabel')}
              value={exercise.focus}
              onValueChange={(next) => onChange(setFocus(exercise, next))}
              options={[
                { value: 'pragmatics', label: t('focusPragmatics') },
                { value: 'vocabulary', label: t('focusVocabulary') },
              ]}
            />
          </Field>
          <Field label={t('packLabel')} htmlFor="inf-pack">
            <PackSelect exercise={exercise} onChange={onChange} />
          </Field>
        </div>

        <Callout tone="tip" icon={Info}>
          {t.rich('packTip', {
            b: (chunks) => <b>{chunks}</b>,
            mono: (chunks) => (
              <span className="font-mono text-[11px] text-(--ssz-text-muted)">{chunks}</span>
            ),
            pack: pack?.language ?? exercise.language,
          })}
        </Callout>
        <Notes notes={headNotes} />
      </Card>

      {audio ? (
        <>
          <AudioSourceCard
            draft={audioDraftOf(exercise)}
            onChange={(next) => onChange(withAudioDraft(exercise, next))}
          />
          <Notes notes={audioNotes('source')} />
          <AudioTranscriptCard
            draft={audioDraftOf(exercise)}
            onChange={(next) => onChange(withAudioDraft(exercise, next))}
          />
          <Notes notes={audioNotes('transcript')} />
          <Callout
            tone={hasTranscript ? 'info' : 'warn'}
            icon={hasTranscript ? Check : AlertTriangle}
          >
            {t.rich('transcriptCallout', { b: (chunks) => <b>{chunks}</b> })}
          </Callout>
        </>
      ) : (
        <Card
          icon={Type}
          title={t('textTitle')}
          labelledBy="inf-text-title"
          note={
            <span className="font-mono">{t('words', { count: wordsIn(exercise.passage) })}</span>
          }
        >
          <Field
            label={t('passageTitleLabel')}
            htmlFor="inf-passage-title"
            message={{ tone: 'hint', text: t('passageTitleHelp'), id: 'inf-passage-title-help' }}
          >
            <Input
              id="inf-passage-title"
              aria-describedby="inf-passage-title-help"
              className="text-base"
              style={READING}
              value={exercise.passageTitle}
              placeholder={pack?.placeholders.passageTitle ?? ''}
              onChange={(event) => onChange(setPassageTitle(exercise, event.target.value))}
            />
          </Field>
          <Field
            label={t('passageLabel')}
            htmlFor="inf-passage"
            required
            message={
              missingText
                ? { tone: 'error', text: t('passageMissing'), id: 'inf-passage-missing' }
                : undefined
            }
          >
            <Textarea
              id="inf-passage"
              rows={9}
              data-bad={missingText ? 'true' : undefined}
              aria-required
              aria-invalid={missingText || undefined}
              aria-describedby={missingText ? 'inf-passage-missing' : undefined}
              className="min-h-[150px] text-base leading-relaxed data-[bad=true]:border-destructive"
              style={READING}
              value={exercise.passage}
              placeholder={pack?.placeholders.passage ?? ''}
              onChange={(event) => onChange(setPassage(exercise, event.target.value))}
            />
          </Field>
          <Callout tone="tip">{t('textTip')}</Callout>
        </Card>
      )}
    </div>
  );
}

/**
 * The packs the course language has. With none the select is inert and says so: a course
 * without a pack reads its cells from digits only (Q2-A) and is never given Norwegian.
 */
function PackSelect<T extends InformationTransferContent>({
  exercise,
  onChange,
}: StepSourceProps<T>) {
  const t = useTranslations('Authoring.informationTransfer.step1');
  const packs: FormatPack[] = packsFor(exercise.language);
  const current = packOf(exercise);

  return (
    <Select
      value={current?.language ?? ''}
      disabled={packs.length === 0}
      onValueChange={(language) => onChange(setLanguage(exercise, language))}
    >
      <SelectTrigger id="inf-pack" aria-label={t('packLabel')}>
        <SelectValue placeholder={t('packNone')} />
      </SelectTrigger>
      <SelectContent>
        {packs.map((pack) => (
          <SelectItem key={pack.language} value={pack.language}>
            {pack.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
