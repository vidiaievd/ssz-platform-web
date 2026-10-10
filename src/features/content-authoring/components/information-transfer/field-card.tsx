'use client';

import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  canon,
  expectedOf,
  FIELD_TYPES,
  inSource,
  isFormatType,
  issues,
  packOf,
  sourceText,
  type Field as FieldModel,
  type FieldType,
  type InformationTransferContent,
} from '@/lib/shared-kernel/information-transfer';

import { AudioSegmentField } from '../audio';
import { Notes } from '../dictation/notes';
import { Field } from '../highlight-in-text/parts';
import { DELETE, MONO, PairCard, READING } from '../minimal-pairs/parts';
import { ToggleRow } from '../toggle-row';
import {
  moveField,
  removeExpected,
  removeField,
  setExpected,
  setField,
  setFieldAudio,
} from './edits';
import { isSourceOrForm, useIssueCopy, useTypeDescription, useTypeLabel } from './issue-copy';

export interface FieldCardProps<T extends InformationTransferContent> {
  exercise: T;
  field: FieldModel;
  index: number;
  onChange: (next: T) => void;
}

/** What a format cell shows as its example when the course has no pack: digits read the same everywhere. */
function useExample(): (type: FieldType) => string {
  const t = useTranslations('Authoring.informationTransfer.types');
  return (type) => {
    switch (type) {
      case 'time':
        return t('time.example');
      case 'date':
        return t('date.example');
      case 'number':
        return t('number.example');
      case 'money':
        return t('money.example');
      case 'phone':
        return t('phone.example');
      case 'name':
      case 'word':
        return '';
    }
  };
}

/**
 * One field of the blank — one fact, one element of the exercise (plan 73 §7.3).
 *
 * The card turns red for the three things that make the cell ungradable or mute: no label, no
 * expected answer, no explanation — and for a key the core cannot read as its own type, which
 * would fail the author's own answer. What it says about the key is the kernel's own check
 * (`canon`, `inSource`), the same one the issue list runs, so the card and the gate agree.
 */
export function FieldCard<T extends InformationTransferContent>({
  exercise,
  field,
  index,
  onChange,
}: FieldCardProps<T>) {
  const t = useTranslations('Authoring.informationTransfer.step2');
  const typeLabel = useTypeLabel();
  const typeDescription = useTypeDescription();
  const example = useExample();
  const copy = useIssueCopy();
  const pack = packOf(exercise);

  const last = exercise.fields.length - 1;
  const expected = expectedOf(field);
  const format = isFormatType(field.type);
  const unreadable = format
    ? expected.filter((value) => canon(field.type, value, pack, exercise.grading).length === 0)
    : [];
  const hasSource = sourceText(exercise).trim() !== '';
  const missing =
    hasSource && expected.length > 0 && !format && !expected.some((e) => inSource(exercise, e));
  const noWhy = field.why.trim() === '';
  const bad = field.label.trim() === '' || expected.length === 0 || noWhy || unreadable.length > 0;
  const name = field.label.trim() === '' ? t('fieldNew') : field.label;
  const key = `inf-${field.id}`;
  // The two findings about this field the card has no control for.
  const notes = issues(exercise)
    .filter(isSourceOrForm)
    .filter(
      (issue) =>
        'fieldId' in issue &&
        issue.fieldId === field.id &&
        (issue.code === 'INF_DUPLICATE_LABEL' || issue.code === 'INF_SENTENCE_ANSWER'),
    )
    .map((issue) => ({
      key: issue.code,
      level: issue.level,
      text: copy.describe(issue, { bare: true }),
    }));

  const expectedMessage =
    unreadable.length > 0
      ? {
          tone: 'error' as const,
          text: t('unreadable', {
            value: unreadable[0] ?? '',
            type: typeLabel(field.type).toLowerCase(),
          }),
        }
      : missing
        ? { tone: 'error' as const, text: t('notInSource') }
        : expected.length > 1
          ? { tone: 'hint' as const, text: t('spellings', { count: expected.length }) }
          : undefined;

  return (
    <PairCard
      index={index}
      title={name}
      bad={bad}
      head={
        <>
          <span
            data-kind={field.required ? 'answer' : undefined}
            className={`inline-block rounded-full px-[7px] py-0.5 text-[10px] tracking-wide whitespace-nowrap ${
              field.required
                ? 'bg-(--ssz-color-primary-50) text-(--ssz-color-primary-700)'
                : 'bg-(--ssz-bg-muted) text-(--ssz-text-secondary)'
            }`}
          >
            {typeLabel(field.type)}
          </span>
          <span className="flex-1" />
          <span className="text-[11px] text-(--ssz-text-muted)" style={MONO}>
            {field.id}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === 0}
            aria-label={`${t('moveUp')} — ${name}`}
            onClick={() => onChange(moveField(exercise, index, -1))}
          >
            <ChevronUp className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === last}
            aria-label={`${t('moveDown')} — ${name}`}
            onClick={() => onChange(moveField(exercise, index, 1))}
          >
            <ChevronDown className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={DELETE}
            disabled={exercise.fields.length < 2}
            aria-label={`${t('delete')} — ${name}`}
            onClick={() => onChange(removeField(exercise, field.id))}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-2.5 gap-y-3 min-[560px]:grid-cols-[minmax(0,1.25fr)_minmax(150px,auto)_90px]">
        <Field label={t('labelLabel')} htmlFor={`${key}-label`} required>
          <Input
            id={`${key}-label`}
            className="text-base"
            style={READING}
            value={field.label}
            placeholder={pack?.placeholders.label ?? ''}
            aria-required
            onChange={(event) =>
              onChange(setField(exercise, field.id, { label: event.target.value }))
            }
          />
        </Field>
        <Field
          label={t('kindLabel')}
          htmlFor={`${key}-type`}
          message={{ tone: 'hint', text: typeDescription(field.type), id: `${key}-type-help` }}
        >
          <Select
            value={field.type}
            onValueChange={(type) =>
              onChange(setField(exercise, field.id, { type: type as FieldType }))
            }
          >
            <SelectTrigger id={`${key}-type`} aria-label={t('kindLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {typeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={t('unitLabel')}
          htmlFor={`${key}-unit`}
          message={{ tone: 'hint', text: t('unitHelp'), id: `${key}-unit-help` }}
        >
          <Input
            id={`${key}-unit`}
            aria-describedby={`${key}-unit-help`}
            value={field.unit}
            placeholder={pack?.placeholders.unit ?? ''}
            onChange={(event) =>
              onChange(setField(exercise, field.id, { unit: event.target.value }))
            }
          />
        </Field>
      </div>

      <Field
        label={t('expectedLabel')}
        htmlFor={`${key}-expected-0`}
        required
        message={
          expectedMessage === undefined
            ? undefined
            : { ...expectedMessage, id: `${key}-expected-message` }
        }
      >
        {[...field.expected, ''].map((value, k) => (
          // The list is positional: a wording has no identity but its place, and the trailing
          // empty row is always the last. An index key is the honest one here.
          <div key={k} className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Input
              id={`${key}-expected-${k}`}
              {...(k > 0 ? { 'aria-label': `${t('wordingPlaceholder')} — ${name}` } : {})}
              className="text-base"
              style={READING}
              value={value}
              placeholder={
                k > 0
                  ? t('wordingPlaceholder')
                  : (pack?.placeholders.expected[field.type] ?? example(field.type))
              }
              aria-describedby={
                expectedMessage === undefined ? undefined : `${key}-expected-message`
              }
              onChange={(event) => onChange(setExpected(exercise, field.id, k, event.target.value))}
            />
            {k > 0 && value !== '' ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={DELETE}
                aria-label={`${t('removeWording')} — ${name}`}
                onClick={() => onChange(removeExpected(exercise, field.id, k))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            ) : (
              <span />
            )}
          </div>
        ))}
      </Field>

      <Field
        label={t('whyLabel')}
        htmlFor={`${key}-why`}
        required
        message={
          noWhy
            ? { tone: 'error', text: t('whyMissing'), id: `${key}-why-message` }
            : { tone: 'hint', text: t('whyHelp'), id: `${key}-why-message` }
        }
      >
        <Textarea
          id={`${key}-why`}
          rows={2}
          className="text-base"
          style={READING}
          value={field.why}
          aria-required
          aria-invalid={noWhy || undefined}
          aria-describedby={`${key}-why-message`}
          placeholder={pack?.placeholders.why ?? ''}
          onChange={(event) => onChange(setField(exercise, field.id, { why: event.target.value }))}
        />
      </Field>

      <Field
        label={t('hintLabel')}
        htmlFor={`${key}-hint`}
        message={{ tone: 'hint', text: t('hintHelp'), id: `${key}-hint-help` }}
      >
        <Input
          id={`${key}-hint`}
          aria-describedby={`${key}-hint-help`}
          value={field.hint}
          placeholder={pack?.placeholders.hint ?? ''}
          onChange={(event) => onChange(setField(exercise, field.id, { hint: event.target.value }))}
        />
      </Field>

      {exercise.sourceKind === 'audio' && (
        <AudioSegmentField
          name={name}
          segment={field.audio}
          onChange={(audio) => onChange(setFieldAudio(exercise, field.id, audio))}
        />
      )}

      <Notes notes={notes} />

      <ToggleRow
        label={t('requiredLabel')}
        help={t('requiredHelp')}
        checked={field.required}
        onChange={(required) => onChange(setField(exercise, field.id, { required }))}
      />
    </PairCard>
  );
}
