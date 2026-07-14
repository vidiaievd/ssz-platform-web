'use client';

import { useState } from 'react';
import { ChevronDown, Table2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { ExpandedVocabItem } from '@/features/learning';
import { cn } from '@/lib/utils';

/* ─── paradigm field config ──────────────────────────────────────────────────
 * Which grammaticalProperties keys to surface, in order, per part of speech.
 * Keys mirror the content-service Norwegian schema
 * (grammatical-properties-validator.service.ts). `gender` and `verb_class` are
 * enums rendered via a value-label lookup; the rest are plain form strings.
 * ────────────────────────────────────────────────────────────────────────── */

type PosKey = 'noun' | 'verb' | 'adj';

interface FieldDef {
  /** grammaticalProperties key */
  key: string;
  /** i18n label key under Learning.vocabSection.forms */
  labelKey: string;
  /** enum value that needs its own translated label ('gender') */
  enumKind?: 'gender';
}

const FIELDS: Record<PosKey, FieldDef[]> = {
  noun: [
    { key: 'gender', labelKey: 'gender', enumKind: 'gender' },
    { key: 'plural_form', labelKey: 'plural' },
    { key: 'definite_singular', labelKey: 'definiteSingular' },
    { key: 'definite_plural', labelKey: 'definitePlural' },
  ],
  verb: [
    { key: 'verb_class', labelKey: 'class' },
    { key: 'present_tense', labelKey: 'present' },
    { key: 'past_tense', labelKey: 'past' },
    { key: 'perfect_tense', labelKey: 'perfect' },
  ],
  adj: [
    { key: 'neuter_form', labelKey: 'neuter' },
    { key: 'plural_form', labelKey: 'plural' },
    { key: 'comparative', labelKey: 'comparative' },
    { key: 'superlative', labelKey: 'superlative' },
  ],
};

/** Base-form row label per POS (the headword is the base form). */
const BASE_LABEL: Record<PosKey, string> = {
  noun: 'baseNoun',
  verb: 'baseVerb',
  adj: 'baseAdj',
};

const GENDER_LABEL: Record<string, string> = {
  masculine: 'genderMasculine',
  feminine: 'genderFeminine',
  neuter: 'genderNeuter',
  common: 'genderCommon',
};

function posKey(pos: string): PosKey {
  if (pos === 'verb') return 'verb';
  if (pos === 'adj') return 'adj';
  return 'noun';
}

/** Rows that actually have a value for this item, base form first. */
function buildRows(item: ExpandedVocabItem): { key: string; def: FieldDef }[] {
  const props = item.grammaticalProperties ?? {};
  return FIELDS[posKey(item.pos)]
    .filter((def) => {
      const val = props[def.key];
      return typeof val === 'string' && val.length > 0;
    })
    .map((def) => ({ key: def.key, def }));
}

/** True when the item has any paradigm forms worth showing. */
export function hasForms(item: ExpandedVocabItem): boolean {
  return buildRows(item).length > 0;
}

export interface VocabFormsTableProps {
  item: ExpandedVocabItem;
  /**
   * Initial open state — driven by the section-level "show all forms" toggle.
   * The parent remounts this component (via a key that includes this value) so
   * the initial state re-applies when the toggle flips or the card changes.
   */
  openByDefault: boolean;
}

export function VocabFormsTable({ item, openByDefault }: VocabFormsTableProps) {
  const t = useTranslations('Learning.vocabSection.forms');
  const [open, setOpen] = useState(openByDefault);

  const rows = buildRows(item);
  if (rows.length === 0) return null;

  const pk = posKey(item.pos);
  const props = item.grammaticalProperties ?? {};

  function renderValue(def: FieldDef): string {
    const raw = props[def.key] ?? '';
    if (def.enumKind === 'gender') {
      const labelKey = GENDER_LABEL[raw];
      return labelKey ? t(labelKey as Parameters<typeof t>[0]) : raw;
    }
    if (def.key === 'verb_class') return raw.replace(/_/g, ' ');
    return raw;
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-lg border px-3 py-2',
          'text-[12px] font-semibold text-(--ssz-text-secondary)',
          'border-(--ssz-border-default) bg-transparent hover:bg-subtle',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
        )}
        style={{ fontFamily: 'var(--ssz-font-ui)' }}
      >
        <Table2 size={13} aria-hidden="true" />
        <span>{open ? t('hide') : t('show')}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          style={{
            marginLeft: 'auto',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--ssz-duration-fast) ease',
          }}
        />
      </button>

      {open && (
        <table className="mt-2 w-full border-collapse text-left">
          <caption className="sr-only">{t('title')}</caption>
          <tbody>
            {/* Base form (the headword). */}
            <tr>
              <th
                scope="row"
                className="py-1.5 pr-3 align-top text-[11px] font-semibold text-(--ssz-text-muted)"
              >
                {t(BASE_LABEL[pk] as Parameters<typeof t>[0])}
              </th>
              <td
                className="py-1.5 font-reading text-[14px] font-semibold text-(--ssz-text-primary)"
                lang="nb"
              >
                {item.word}
              </td>
            </tr>
            {rows.map(({ key, def }) => (
              <tr key={key} className="border-t border-(--ssz-border-default)">
                <th
                  scope="row"
                  className="py-1.5 pr-3 align-top text-[11px] font-semibold text-(--ssz-text-muted)"
                >
                  {t(def.labelKey as Parameters<typeof t>[0])}
                </th>
                <td
                  className="py-1.5 font-reading text-[14px] text-(--ssz-text-primary)"
                  lang={def.enumKind ? undefined : 'nb'}
                >
                  {renderValue(def)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
