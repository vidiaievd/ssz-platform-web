'use client';

import { Headphones } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Segmented } from '@/components/ui/segmented';
import {
  ATTEMPTS,
  audioIssuesOf,
  HINTS_AFTER,
  issues,
  readyFields,
  REVEAL_KEYS,
  type Attempts,
  type HintsAfter,
  type InformationTransferContent,
  type RevealKey,
  type ShowSource,
} from '@/lib/shared-kernel/information-transfer';

import { AudioRulesCard, useAudioIssueCopy } from '../audio';
import { Notes, type Note } from '../dictation/notes';
import { Callout, Card, Field, StepHead } from '../highlight-in-text/parts';
import { ToggleRow } from '../toggle-row';
import { audioDraftOf, setAnswering, withAudioDraft } from './edits';
import { useIssueCopy } from './issue-copy';

export interface StepDeliveryProps<T extends InformationTransferContent> {
  exercise: T;
  onChange: (next: T) => void;
}

/**
 * Step 4: how it is played (plan 73 §7.5, INF-B17…B21).
 *
 * Difficulty lives here and nowhere else — what is visible while the form is filled, how many
 * checks of the whole blank, when hints and the key come out. Nothing in steps 1–3 changes
 * between an A1 class and a B1 one. A recording adds the layer's own rules card on top; a text
 * adds the one setting that would turn this into another exercise, which the kernel blocks.
 *
 * The prototype's numeric values (`attempts: 1|2|3|0`, `hintsAfter: 0|1|9`) stay numbers in the
 * document; the segmented control only knows strings, so they are mapped at its edge.
 */
export function StepDelivery<T extends InformationTransferContent>({
  exercise,
  onChange,
}: StepDeliveryProps<T>) {
  const t = useTranslations('Authoring.informationTransfer.step4');
  const copy = useIssueCopy();
  const describeAudio = useAudioIssueCopy();
  const a = exercise.answering;
  const audio = exercise.sourceKind === 'audio';
  const ready = readyFields(exercise).length;

  const notes: Note[] = issues(exercise)
    .filter((issue) => issue.step === 4)
    .map((issue, i) => ({
      key: `${issue.code}-${i}`,
      level: issue.level,
      text: copy.describe(issue),
    }));
  const audioNotes: Note[] = audio
    ? audioIssuesOf(exercise)
        .filter((issue) => issue.part === 'rules')
        .map((issue) => ({ key: issue.code, level: issue.level, text: describeAudio(issue) }))
    : [];

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      {audio && (
        <>
          <AudioRulesCard
            draft={audioDraftOf(exercise)}
            onChange={(next) => onChange(withAudioDraft(exercise, next))}
            itemNoun={t('itemNoun')}
          />
          <Notes notes={audioNotes} />
        </>
      )}

      <Card>
        {!audio && (
          <Field
            label={t('showSource.label')}
            message={{ tone: 'hint', text: t('showSource.help'), id: 'inf-show-source-help' }}
          >
            <Segmented<ShowSource>
              aria-label={t('showSource.label')}
              value={a.showSource}
              onValueChange={(showSource) => onChange(setAnswering(exercise, { showSource }))}
              options={[
                { value: 'always', label: t('showSource.always') },
                { value: 'afterAnswer', label: t('showSource.afterAnswer') },
              ]}
            />
          </Field>
        )}
        <Field
          label={t('attempts.label')}
          message={{ tone: 'hint', text: t('attempts.help'), id: 'inf-attempts-help' }}
        >
          <Segmented<string>
            aria-label={t('attempts.label')}
            value={String(a.attempts)}
            onValueChange={(value) =>
              onChange(setAnswering(exercise, { attempts: Number(value) as Attempts }))
            }
            options={ATTEMPTS.map((value) => ({
              value: String(value),
              label: value === 0 ? t('attempts.unlimited') : String(value),
            }))}
          />
        </Field>
        <Field
          label={t('hints.label')}
          message={{ tone: 'hint', text: t('hints.help'), id: 'inf-hints-help' }}
        >
          <Segmented<string>
            aria-label={t('hints.label')}
            value={String(a.hintsAfter)}
            onValueChange={(value) =>
              onChange(setAnswering(exercise, { hintsAfter: Number(value) as HintsAfter }))
            }
            options={HINTS_AFTER.map((value) => ({
              value: String(value),
              label:
                value === 0
                  ? t('hints.start')
                  : value === 1
                    ? t('hints.afterOne')
                    : t('hints.never'),
            }))}
          />
        </Field>
        <Field
          label={t('reveal.label')}
          message={{ tone: 'hint', text: t('reveal.help'), id: 'inf-reveal-help' }}
        >
          <Segmented<RevealKey>
            aria-label={t('reveal.label')}
            value={a.revealKey}
            onValueChange={(revealKey) => onChange(setAnswering(exercise, { revealKey }))}
            options={REVEAL_KEYS.map((value) => ({
              value,
              label:
                value === 'immediately'
                  ? t('reveal.immediately')
                  : value === 'afterLastAttempt'
                    ? t('reveal.afterLastAttempt')
                    : t('reveal.never'),
            }))}
          />
        </Field>
        <ToggleRow
          label={t('oneAtATime.label')}
          help={t('oneAtATime.help', { count: ready })}
          checked={a.oneAtATime}
          onChange={(oneAtATime) => onChange(setAnswering(exercise, { oneAtATime }))}
        />
        <Notes notes={notes} />
      </Card>

      {audio && (
        <Callout tone="tip" icon={Headphones}>
          {t('fragmentsTip')}
        </Callout>
      )}
    </div>
  );
}
