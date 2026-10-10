'use client';

import { useTranslations } from 'next-intl';
import { ListChecks, Target } from 'lucide-react';

import { Segmented } from '@/components/ui/segmented';
import {
  allWords,
  contrastsInSet,
  filledWords,
  issues,
  MEMORY_POLICIES,
  neededToPass,
  SITTINGS,
  type Sittings,
} from '@/lib/shared-kernel/minimal-pairs';

import { Notes } from '../dictation/notes';
import { Card, Field, StepHead } from '../highlight-in-text/parts';
import { ToggleRow } from '../toggle-row';
import { setPassPct, setScoring, type DocumentUpdate, type MinimalPairsDocument } from './edits';
import { useIssueCopy } from './issue-copy';
import { MeterRow, MONO, NumberField } from './parts';

/** The word atoms are drawn from the first few words, then an ellipsis — the prototype's four. */
const ATOM_WORDS = 4;

export interface StepResultProps {
  exercise: MinimalPairsDocument;
  onChange: DocumentUpdate;
}

/**
 * Step 5: the pass mark and what the result may move (plan 72 §7.6, MP-B23…B26).
 *
 * The only real decision here is memory. Under `contrast` the answers rate the contrast alone;
 * `contrast+word` lets the set's score reach the words too, which the atom card says costs
 * something. The notes under the meter are the kernel's, so what Q1 and Q4 do not yet deliver
 * (the contrast's own review card, the exposure event) is said in the author's language rather
 * than promised by a switch that does nothing (§3.10).
 *
 * «What the teacher gets» lists the pairs without numbers: there is no per-exercise report to
 * compute them from, and a made-up percentage in a product is not a placeholder (Q5-A).
 */
export function StepResult({ exercise, onChange }: StepResultProps) {
  const t = useTranslations('Authoring.minimalPairs.step5');
  const copy = useIssueCopy(exercise);
  const sc = exercise.scoring;
  const probes = exercise.set.probes;

  const notes = issues(exercise)
    .filter((issue) => issue.step === 5)
    .map((issue, i) => ({
      key: `${issue.code}-${i}`,
      level: issue.level,
      text: copy.describe(issue),
    }));

  const families = contrastsInSet(exercise).filter((id) => id !== '');
  const contrastAtom = `contrast:${families.length === 0 ? '…' : families.join(' · contrast:')}`;
  const spellings = allWords(exercise)
    .map((w) => w.text.trim())
    .filter((text) => text !== '');
  const wordAtoms =
    spellings.length === 0
      ? '…'
      : `${spellings.slice(0, ATOM_WORDS).join(' · ')}${spellings.length > ATOM_WORDS ? ' …' : ''}`;

  const rated = exercise.pairs.filter((p) => filledWords(p).length > 0);

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <MeterRow
        figure={sc.passPct}
        unit="%"
        sub={t('need', { need: neededToPass(sc.passPct, probes), probes })}
        value={sc.passPct}
        barLabel={t('passMeter')}
      >
        <NumberField
          label={t('passField')}
          min={0}
          max={100}
          step={5}
          value={sc.passPct}
          onCommit={(passPct) => onChange(setPassPct(exercise, passPct))}
        />
      </MeterRow>

      <Card icon={Target} title={t('rates.title')}>
        <Field label={t('memory.label')}>
          <Segmented
            aria-label={t('memory.label')}
            value={sc.memory}
            onValueChange={(memory) => onChange(setScoring(exercise, { memory }))}
            options={MEMORY_POLICIES.map((value) => ({ value, label: t(`memory.${value}`) }))}
          />
        </Field>

        <div className="grid gap-2 min-[561px]:grid-cols-2">
          <AtomCard on={sc.memory !== 'none'} name={contrastAtom} body={t('atoms.contrast')} />
          <AtomCard on={sc.memory === 'contrast+word'} name={wordAtoms} body={t('atoms.words')} />
        </div>

        <Notes notes={notes} />

        <ToggleRow
          label={t('exposure.label')}
          help={t('exposure.help')}
          checked={sc.logWordExposure}
          onChange={(logWordExposure) => onChange(setScoring(exercise, { logWordExposure }))}
        />

        <Field
          label={t('sittings.label')}
          message={{ tone: 'hint', text: t('sittings.hint'), id: 'mp-sittings-help' }}
        >
          <Segmented
            aria-label={t('sittings.label')}
            value={String(sc.attempts)}
            onValueChange={(value) =>
              onChange(setScoring(exercise, { attempts: Number(value) as Sittings }))
            }
            options={SITTINGS.map((value) => ({
              value: String(value),
              label: value === 0 ? t('sittings.unlimited') : String(value),
            }))}
          />
        </Field>
      </Card>

      <Card icon={ListChecks} title={t('teacher.title')} labelledBy="mp-teacher-title">
        <p className="m-0 text-xs text-(--ssz-text-muted)">{t('teacher.lead')}</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rated.map((pair) => (
            <li
              key={pair.id}
              className="grid items-center gap-2.5 text-sm"
              style={{ gridTemplateColumns: 'minmax(0,1fr) 120px 46px' }}
            >
              <span className="truncate">
                {filledWords(pair)
                  .map((w) => w.text)
                  .join(' / ')}
              </span>
              <span aria-hidden="true" className="h-[7px] rounded-full bg-(--ssz-bg-muted)" />
              <b className="text-right text-xs font-normal text-(--ssz-text-muted)" style={MONO}>
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

/** `mp-atom`: one of the two things a result can rate; dim when this setting leaves it alone. */
function AtomCard({ on, name, body }: { on: boolean; name: string; body: string }) {
  return (
    <div
      data-on={on ? 'true' : undefined}
      className={`rounded-(--ssz-radius-md) border px-3 py-2.5 ${
        on
          ? 'border-(--ssz-color-primary-200) bg-(--ssz-color-primary-50)'
          : 'border-(--ssz-border-default) bg-(--ssz-bg-subtle) opacity-55'
      }`}
    >
      <b className="text-sm font-semibold" style={MONO}>
        {name}
      </b>
      <p className="m-0 mt-1 text-xs leading-normal text-(--ssz-text-secondary)">{body}</p>
    </div>
  );
}
