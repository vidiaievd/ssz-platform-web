'use client';

import { useState } from 'react';
import { Check, Grid3x3, List, Lock, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  issues,
  packOf,
  paradigmOf,
  previewParadigmSwitch,
  type InflectionTableContent,
} from '@/lib/shared-kernel/inflection-table';

import { Callout, Card, EmptyState, Field, StepHead } from '../highlight-in-text/parts';
import { Notes, type Note } from '../dictation/notes';
import { pickParadigm, setInstruction, toggleSlot } from './edits';
import { useIssueCopy } from './issue-copy';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;
const MONO = 'font-mono text-[10px] text-(--ssz-text-muted)';

export interface StepParadigmProps<T extends InflectionTableContent> {
  exercise: T;
  onChange: (next: T) => void;
}

/**
 * Step 1: which system of forms (plan 69 §7.2).
 *
 * The columns are the pack's, not the author's (IT-B2): the author picks a part of speech and
 * switches slots off, and cannot rename, reorder or add one. Picking another part of speech
 * replaces the columns *and* clears the rows, so with rows on the table it is not applied at
 * once — the panel says how many rows go first (IT-B4, DECISIONS §1).
 */
export function StepParadigm<T extends InflectionTableContent>({
  exercise,
  onChange,
}: StepParadigmProps<T>) {
  const t = useTranslations('Authoring.inflectionTable.step1');
  const copy = useIssueCopy(exercise);
  const [switching, setSwitching] = useState<string | null>(null);

  const pack = packOf(exercise);
  const paradigm = paradigmOf(exercise);

  const found = issues(exercise).filter((issue) => issue.step === 1);
  const notes: Note[] = found.map((issue) => ({
    key: issue.code + ('slotId' in issue ? issue.slotId : ''),
    level: issue.level,
    text: copy.describe(issue),
  }));

  if (!pack || !paradigm) {
    return (
      <div className="flex flex-col gap-5">
        <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />
        <EmptyState
          icon={Grid3x3}
          title={t('noPackTitle')}
          body={t('noPackBody', { language: exercise.language })}
        />
      </div>
    );
  }

  const choose = (paradigmId: string) => {
    if (paradigmId === exercise.paradigmId) return;
    if (previewParadigmSwitch(exercise, paradigmId).rowsCleared > 0) setSwitching(paradigmId);
    else onChange(pickParadigm(exercise, paradigmId));
  };

  const target = pack.paradigms.find((p) => p.id === switching);
  const cleared = target ? previewParadigmSwitch(exercise, target.id).rowsCleared : 0;
  const on = paradigm.slots.filter((s) => exercise.slots.includes(s.id)).length;

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card
        icon={Grid3x3}
        title={t('packTitle')}
        labelledBy="it-pack-title"
        note={<span className="font-mono">{`${pack.id} · v${pack.version}`}</span>}
      >
        <Field
          label={t('packLabel')}
          message={{ tone: 'hint', text: t('packHint'), id: 'it-pack-hint' }}
        >
          <div className="flex items-center gap-2 rounded-(--ssz-radius-sm) border border-(--ssz-border-default) bg-(--ssz-bg-subtle) px-3 py-2.5">
            <Lock size={14} aria-hidden="true" className="shrink-0 text-(--ssz-text-muted)" />
            <b className="font-semibold">{pack.label}</b>
            <span className="ml-auto text-xs text-(--ssz-text-muted)">
              {t('packCourseLanguage', { language: exercise.language })}
            </span>
          </div>
        </Field>

        <Field
          label={t('posLabel')}
          required
          message={{ tone: 'hint', text: t('posHint'), id: 'it-pos-hint' }}
        >
          <div
            role="group"
            aria-label={t('posLabel')}
            aria-describedby="it-pos-hint"
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}
          >
            {pack.paradigms.map((p) => {
              const pressed = p.id === exercise.paradigmId;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => choose(p.id)}
                  className={[
                    'flex flex-col items-start gap-0.5 rounded-(--ssz-radius-sm) border px-3 py-[11px] text-left',
                    'focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none',
                    pressed
                      ? 'border-(--ssz-color-primary-500) bg-(--ssz-color-primary-50) shadow-[inset_0_0_0_1px_var(--ssz-color-primary-500)]'
                      : 'border-(--ssz-border-strong) hover:border-(--ssz-color-primary-400)',
                  ].join(' ')}
                >
                  <b className="text-sm font-semibold">{p.label}</b>
                  <span className="text-xs text-(--ssz-text-muted)">
                    {t('slotCount', { count: p.slots.length })}
                  </span>
                  <em className="font-mono text-[10px] not-italic text-(--ssz-text-muted)">
                    {p.slots.map((s) => s.short).join(' · ')}
                  </em>
                </button>
              );
            })}
          </div>
        </Field>

        {target && (
          <Callout tone="warn">
            <b className="font-semibold">{t('switchTitle', { paradigm: target.label })}</b>{' '}
            {t('switchBody', { count: cleared })}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onChange(pickParadigm(exercise, target.id));
                  setSwitching(null);
                }}
              >
                <Check className="size-3.5" aria-hidden />
                {t('switchConfirm')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSwitching(null)}>
                <X className="size-3.5" aria-hidden />
                {t('switchCancel')}
              </Button>
            </div>
          </Callout>
        )}
      </Card>

      <Card
        icon={List}
        title={t('slotsTitle')}
        labelledBy="it-slots-title"
        note={t('slotsOf', { on, all: paradigm.slots.length })}
      >
        <ul className="m-0 flex list-none flex-col p-0">
          {paradigm.slots.map((slot, index) => {
            const checked = exercise.slots.includes(slot.id);
            return (
              <li
                key={slot.id}
                data-on={checked}
                className={[
                  'flex items-center gap-3 py-[9px]',
                  index > 0 ? 'border-t border-(--ssz-border-default)' : '',
                  checked ? '' : 'opacity-50',
                ].join(' ')}
              >
                <Switch
                  checked={checked}
                  aria-label={t('slotToggle', { slot: slot.label })}
                  onCheckedChange={() => onChange(toggleSlot(exercise, slot.id))}
                />
                <div className="flex flex-col">
                  <strong className="text-sm font-semibold">{slot.label}</strong>
                  <span className={MONO}>{slot.atom}</span>
                </div>
                <span className="flex-1" />
                <span className="text-xs text-(--ssz-text-muted)">{slot.short}</span>
              </li>
            );
          })}
        </ul>
        <Notes notes={notes} />
        <Callout tone="tip">
          {t.rich('tip', {
            atom: paradigm.slots[0]?.atom ?? '',
            em: (chunks) => <em>{chunks}</em>,
          })}
        </Callout>
      </Card>

      <Field
        label={t('instructionLabel')}
        htmlFor="it-instruction"
        message={{ tone: 'hint', text: t('instructionHint'), id: 'it-instruction-hint' }}
      >
        <Input
          id="it-instruction"
          aria-describedby="it-instruction-hint"
          value={exercise.instruction}
          placeholder={pack.instruction}
          lang={exercise.language}
          style={READING}
          onChange={(e) => onChange(setInstruction(exercise, e.target.value))}
        />
      </Field>
    </div>
  );
}
