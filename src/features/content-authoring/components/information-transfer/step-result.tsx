'use client';

import type { ReactNode } from 'react';
import { List, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Segmented } from '@/components/ui/segmented';
import {
  issues,
  MEMORIES,
  readyFields,
  skillOf,
  type InformationTransferContent,
  type Memory,
} from '@/lib/shared-kernel/information-transfer';

import { Notes, type Note } from '../dictation/notes';
import { Card, Field, StepHead } from '../highlight-in-text/parts';
import { MeterRow, MONO, NumberField } from '../minimal-pairs/parts';
import { ToggleRow } from '../toggle-row';
import { setGrading, setScoring } from './edits';
import { useIssueCopy } from './issue-copy';

/** «What the teacher gets» lists the first few ready cells, as the prototype does. */
const REPORT_ROWS = 6;
/** The word atom card names this many lemmas, then an ellipsis. */
const ATOM_WORDS = 4;

export interface StepResultProps<T extends InformationTransferContent> {
  exercise: T;
  onChange: (next: T) => void;
  /**
   * The lemmas of the word atoms the lexical cells are addressed to, from the exercise's own
   * targets (plan 72 deviation 5: words are linked through the shared targets panel, never
   * typed here). Empty, the card names the rule instead of the words.
   */
  wordAtoms?: readonly string[];
}

/**
 * Step 5: the pass mark and what the result may move (plan 73 §7.6, INF-B22…B26).
 *
 * Graded on the server, cell by cell; the percentage is a summary of the cell verdicts. The
 * real decision here is memory: the form as a whole rates a skill — selective listening, or
 * reading for a text — and `skill+words` lets the `word` and `name` cells reach their words.
 * Under «Nothing» the skill card is dimmed too, which the prototype forgot and its own issue
 * line says.
 *
 * What is not live yet — the skill's own review schedule, the exposure event — is said by the
 * kernel's two notes rather than promised by a switch (deviation 17). «What the teacher gets»
 * lists the cells without numbers: there is no per-exercise report to compute them from, and a
 * made-up percentage in a product is not a placeholder (deviation 18).
 */
export function StepResult<T extends InformationTransferContent>({
  exercise,
  onChange,
  wordAtoms = [],
}: StepResultProps<T>) {
  const t = useTranslations('Authoring.informationTransfer.step5');
  const copy = useIssueCopy();
  const sc = exercise.scoring;
  const ready = readyFields(exercise);
  const need = Math.ceil((sc.passPct / 100) * Math.max(1, ready.length));

  const notesOf = (codes: readonly string[]): Note[] =>
    issues(exercise)
      .filter((issue) => issue.step === 5 && codes.includes(issue.code))
      .map((issue, i) => ({
        key: `${issue.code}-${i}`,
        level: issue.level,
        text: copy.describe(issue),
      }));

  const skill = `skill:${skillOf(exercise)}`;
  const words =
    wordAtoms.length === 0
      ? t('atoms.wordsName')
      : `${wordAtoms.slice(0, ATOM_WORDS).join(' · ')}${wordAtoms.length > ATOM_WORDS ? ' …' : ''}`;

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <MeterRow
        figure={sc.passPct}
        unit="%"
        sub={t('need', { need, count: ready.length })}
        value={sc.passPct}
        barLabel={t('passMeter')}
      >
        <NumberField
          label={t('passField')}
          min={0}
          max={100}
          step={5}
          value={sc.passPct}
          onCommit={(passPct) => onChange(setScoring(exercise, { passPct }))}
        />
      </MeterRow>
      <Notes notes={notesOf(['INF_PASS_TOO_HIGH'])} />

      <Card>
        <ToggleRow
          label={t('requiredAll.label')}
          help={t('requiredAll.help')}
          checked={exercise.grading.requiredAll}
          onChange={(requiredAll) => onChange(setGrading(exercise, { requiredAll }))}
        />
        <Notes notes={notesOf(['INF_REQUIRED_ALL'])} />
      </Card>

      <Card icon={Target} title={t('rates.title')} labelledBy="inf-rates-title">
        <Field label={t('memory.label')}>
          <Segmented<Memory>
            aria-label={t('memory.label')}
            value={sc.memory}
            onValueChange={(memory) => onChange(setScoring(exercise, { memory }))}
            options={MEMORIES.map((value) => ({
              value,
              label:
                value === 'skill'
                  ? t('memory.skill')
                  : value === 'skill+words'
                    ? t('memory.skillWords')
                    : t('memory.none'),
            }))}
          />
        </Field>

        <div className="grid gap-2 min-[561px]:grid-cols-2">
          <AtomCard on={sc.memory !== 'none'} name={skill} body={t('atoms.skill')} />
          <AtomCard
            on={sc.memory === 'skill+words'}
            name={words}
            body={t.rich('atoms.words', {
              mono: (chunks) => <span style={MONO}>{chunks}</span>,
            })}
          />
        </div>

        <Notes notes={notesOf(['INF_NO_MEMORY', 'INF_SKILL_CARD_LATER'])} />

        <ToggleRow
          label={t('exposure.label')}
          help={t('exposure.help')}
          checked={sc.logWordExposure}
          onChange={(logWordExposure) => onChange(setScoring(exercise, { logWordExposure }))}
        />
        <Notes notes={notesOf(['INF_EXPOSURE_LATER'])} />
      </Card>

      <Card icon={List} title={t('teacher.title')} labelledBy="inf-teacher-title">
        <p className="m-0 text-xs text-(--ssz-text-muted)">{t('teacher.lead')}</p>
        <ul className="m-0 mt-1 flex list-none flex-col gap-[7px] p-0">
          {ready.slice(0, REPORT_ROWS).map((field) => (
            <li
              key={field.id}
              className="grid items-center gap-2.5 text-sm"
              style={{ gridTemplateColumns: 'minmax(0,1fr) 110px 44px' }}
            >
              <span className="min-w-0 truncate">
                {field.label}{' '}
                <span className="text-[11px] text-(--ssz-text-muted)" style={MONO}>
                  {field.type}
                </span>
              </span>
              <span aria-hidden="true" className="h-[7px] rounded-full bg-(--ssz-bg-muted)" />
              <b
                className="text-right text-[11px] font-normal text-(--ssz-text-muted)"
                style={MONO}
              >
                —
              </b>
            </li>
          ))}
        </ul>
        <p className="m-0 text-xs text-(--ssz-text-muted)">{t('teacher.caption')}</p>
      </Card>
    </div>
  );
}

/** `inf-atom`: one of the two things a result can rate; dim when this setting leaves it alone. */
function AtomCard({ on, name, body }: { on: boolean; name: string; body: ReactNode }) {
  return (
    <div
      data-on={on ? 'true' : undefined}
      className={`rounded-(--ssz-radius-md) border px-3 py-2.5 ${
        on
          ? 'border-(--ssz-color-primary-500) bg-(--ssz-bg-surface)'
          : 'border-(--ssz-border-default) bg-(--ssz-bg-subtle) opacity-50'
      }`}
    >
      <b className="text-[11px] font-semibold text-(--ssz-color-primary-700)" style={MONO}>
        {name}
      </b>
      <p className="m-0 mt-[5px] text-xs leading-snug text-(--ssz-text-secondary)">{body}</p>
    </div>
  );
}
