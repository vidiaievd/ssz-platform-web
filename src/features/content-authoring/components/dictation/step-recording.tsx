'use client';

import { Headphones } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { ExerciseAudioPlayer } from '@/features/student/exercises/audio';
import { audioIssuesOf, issues, type DictationContent } from '@/lib/shared-kernel/dictation';

import { AudioSourceCard, useAudioIssueCopy } from '../audio';
import { Callout, Card, Field, StepHead } from '../highlight-in-text/parts';
import { audioDraftOf, setInstruction, setTitle, withAudioDraft } from './edits';
import { useIssueCopy } from './issue-copy';
import { Notes, type Note } from './notes';
import { useAuthorPlayer } from './use-author-player';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;

export interface StepRecordingProps<T extends DictationContent> {
  exercise: T;
  onChange: (next: T) => void;
}

/**
 * Step 1: the recording — the whole prompt (plan 68 §7.4, BEHAVIOR §1).
 *
 * The title and the standing instruction, then the layer's own source card: a dictation has
 * no switch for listening because without the recording it is a copying exercise. Under it
 * the author hears the clip the way the student will not — no allowance, scrubbing, speed.
 *
 * What the issue list says about step 1 is drawn under the clip, where it is fixed: the
 * missing clip is the blocker a blank draft shows (AC-B1).
 */
export function StepRecording<T extends DictationContent>({
  exercise,
  onChange,
}: StepRecordingProps<T>) {
  const t = useTranslations('Authoring.dictation.step1');
  const copy = useIssueCopy(exercise);
  const describeAudio = useAudioIssueCopy();
  const { eng, simulated } = useAuthorPlayer(exercise.audio);

  const notes: Note[] = [
    ...issues(exercise)
      .filter((issue) => issue.step === 1)
      .map((issue) => ({ key: issue.code, level: issue.level, text: copy.describe(issue) })),
    ...audioIssuesOf(exercise)
      .filter((issue) => issue.part === 'source')
      .map((issue) => ({ key: issue.code, level: issue.level, text: describeAudio(issue) })),
  ].sort((a, b) => Number(b.level === 'blocker') - Number(a.level === 'blocker'));

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card>
        <Field label={t('titleLabel')} htmlFor="dc-title" required>
          <Input
            id="dc-title"
            value={exercise.title}
            placeholder={t('titlePlaceholder')}
            aria-required
            onChange={(event) => onChange(setTitle(exercise, event.target.value))}
          />
        </Field>
        <Field
          label={t('instructionLabel')}
          htmlFor="dc-instruction"
          message={{ tone: 'hint', text: t('instructionHelp'), id: 'dc-instruction-help' }}
        >
          <Input
            id="dc-instruction"
            aria-describedby="dc-instruction-help"
            className="text-base"
            style={READING}
            value={exercise.instruction}
            placeholder={t('instructionPlaceholder')}
            onChange={(event) => onChange(setInstruction(exercise, event.target.value))}
          />
        </Field>
      </Card>

      <AudioSourceCard
        draft={audioDraftOf(exercise)}
        onChange={(next) => onChange(withAudioDraft(exercise, next))}
      />

      <Notes notes={notes} />

      <Card
        icon={Headphones}
        title={t('listenTitle')}
        labelledBy="dc-listen-title"
        note={simulated ? t('listenSimulated') : t('listenNote')}
      >
        <ExerciseAudioPlayer eng={eng} tone="quiet" />
      </Card>

      <Callout tone="tip">{t('tip')}</Callout>
    </div>
  );
}
