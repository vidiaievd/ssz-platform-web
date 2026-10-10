'use client';

import { useState } from 'react';
import { ClipboardList, List, Plus, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  audioIssuesOf,
  issues,
  packOf,
  readyFields,
  scanSource,
  type InformationTransferContent,
  type Layout,
  type ScanHit,
} from '@/lib/shared-kernel/information-transfer';

import { useAudioIssueCopy } from '../audio';
import { Notes, type Note } from '../dictation/notes';
import { Card, Field, StepHead } from '../highlight-in-text/parts';
import { READING, SectionHead } from '../minimal-pairs/parts';
import { addField, setForm } from './edits';
import { FieldCard } from './field-card';
import { isSourceOrForm, useIssueCopy } from './issue-copy';
import { ScanDialog } from './scan-dialog';

export interface StepFormProps<T extends InformationTransferContent> {
  exercise: T;
  onChange: (next: T) => void;
}

/**
 * Step 2: the blank — the fields (plan 73 §7.3).
 *
 * Each field is one fact and one element of the exercise; its id travels with it, so moving
 * a field never moves an explanation. «Lift from the source» reads the text or the transcript
 * for times, dates, amounts and phone numbers and offers each as a new field.
 *
 * What the issue list says about the blank as a whole (too few fields, too many, all free
 * text) is drawn above the cards; what it says about one field is on that field's card.
 */
export function StepForm<T extends InformationTransferContent>({
  exercise,
  onChange,
}: StepFormProps<T>) {
  const t = useTranslations('Authoring.informationTransfer.step2');
  const copy = useIssueCopy();
  const describeAudio = useAudioIssueCopy();
  const [scanning, setScanning] = useState(false);
  const pack = packOf(exercise);

  const hits = scanSource(exercise);
  const ready = readyFields(exercise).length;

  const notes: Note[] = [
    ...issuesOfBlank(exercise).map((issue) => ({
      key: issue.code,
      level: issue.level,
      text: copy.describe(issue),
    })),
    ...audioIssuesOf(exercise)
      .filter((issue) => issue.part === 'segments')
      .map((issue) => ({
        key: `${issue.code}-${issue.itemId}`,
        level: issue.level,
        text: describeAudio(issue),
      })),
  ];

  const insert = (hit: ScanHit) => {
    onChange(addField(exercise, hit.type, hit.value));
    setScanning(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-3 max-[560px]:grid-cols-1">
          <Field
            label={t('formTitleLabel')}
            htmlFor="inf-form-title"
            message={{ tone: 'hint', text: t('formTitleHelp'), id: 'inf-form-title-help' }}
          >
            <Input
              id="inf-form-title"
              aria-describedby="inf-form-title-help"
              className="text-base"
              style={READING}
              value={exercise.form.formTitle}
              placeholder={pack?.placeholders.formTitle ?? ''}
              onChange={(event) => onChange(setForm(exercise, { formTitle: event.target.value }))}
            />
          </Field>
          <Field label={t('layoutLabel')}>
            <Segmented<Layout>
              aria-label={t('layoutLabel')}
              value={exercise.form.layout}
              onValueChange={(layout) => onChange(setForm(exercise, { layout }))}
              options={[
                { value: 'form', label: t('layoutForm'), icon: ClipboardList },
                { value: 'table', label: t('layoutTable'), icon: List },
              ]}
            />
          </Field>
        </div>
      </Card>

      <SectionHead
        eyebrow={t('fieldsEyebrow')}
        title={t('ready', { ready, total: exercise.fields.length })}
      >
        <Button
          type="button"
          variant="outline"
          disabled={hits.length === 0}
          onClick={() => setScanning(true)}
        >
          <Target className="size-4" aria-hidden />
          {hits.length > 0 ? t('liftCount', { count: hits.length }) : t('lift')}
        </Button>
        <Button type="button" variant="outline" onClick={() => onChange(addField(exercise))}>
          <Plus className="size-4" aria-hidden />
          {t('add')}
        </Button>
      </SectionHead>

      <Notes notes={notes} />

      {exercise.fields.map((field, index) => (
        <FieldCard
          key={field.id}
          exercise={exercise}
          field={field}
          index={index}
          onChange={onChange}
        />
      ))}

      <ScanDialog
        open={scanning}
        exercise={exercise}
        hits={hits}
        onOpenChange={setScanning}
        onInsert={insert}
      />
    </div>
  );
}

/** The findings about the blank itself, not about one field: the card says the rest. */
function issuesOfBlank(exercise: InformationTransferContent) {
  return issuesOf(exercise).filter(
    (issue) =>
      issue.code === 'INF_NO_FIELDS' ||
      issue.code === 'INF_FEW_FIELDS' ||
      issue.code === 'INF_MANY_FIELDS' ||
      issue.code === 'INF_ALL_FREE_TEXT',
  );
}

function issuesOf(exercise: InformationTransferContent) {
  return issues(exercise).filter(isSourceOrForm);
}
