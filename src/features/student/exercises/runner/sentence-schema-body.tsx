'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

export interface SchemaField {
  id: string;
  label: string;
}
export interface SchemaToken {
  id: string;
  text: string;
}

/**
 * Content schema for sentence-schema (setningsskjema) exercises.
 * The learner places each token into one of the ordered fields.
 */
export interface SentenceSchemaContent {
  sentence: string;
  schema_type?: 'main' | 'subordinate';
  fields: SchemaField[];
  tokens: SchemaToken[];
  instruction?: string;
}

export interface SentenceSchemaExpectedAnswers {
  placements: Array<{ field_id: string; token_ids: string[] }>;
  explanation?: string;
}

/** Placement map: field id → ordered token ids currently in that field. */
export type SchemaPlacements = Record<string, string[]>;

export interface SentenceSchemaBodyProps {
  content: SentenceSchemaContent;
  value: SchemaPlacements;
  onValueChange: (val: SchemaPlacements) => void;
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
}

const READING = 'var(--ssz-font-reading)';

/** All token ids currently placed in any field. */
function placedIds(value: SchemaPlacements): Set<string> {
  const ids = new Set<string>();
  for (const list of Object.values(value)) for (const id of list) ids.add(id);
  return ids;
}

export function SentenceSchemaBody({
  content,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  ok,
  mode,
  accent,
}: SentenceSchemaBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const isAnswering = phase === 'answering';
  const reveal = phase === 'feedback';
  const accentSoft = modeAccentSoft(mode);
  const [armed, setArmed] = useState<string | null>(null);

  const placed = useMemo(() => placedIds(value), [value]);
  const bank = content.tokens.filter((tk) => !placed.has(tk.id));
  const tokenById = useMemo(
    () => new Map(content.tokens.map((tk) => [tk.id, tk])),
    [content.tokens],
  );

  useEffect(() => {
    onAnswerChange(placed.size === content.tokens.length && content.tokens.length > 0);
  }, [placed, content.tokens.length, onAnswerChange]);

  const removeEverywhere = (next: SchemaPlacements, tokenId: string): SchemaPlacements => {
    const out: SchemaPlacements = {};
    for (const [fieldId, list] of Object.entries(next)) out[fieldId] = list.filter((id) => id !== tokenId);
    return out;
  };

  const placeInField = (fieldId: string) => {
    if (!isAnswering || armed === null) return;
    const cleared = removeEverywhere(value, armed);
    onValueChange({ ...cleared, [fieldId]: [...(cleared[fieldId] ?? []), armed] });
    setArmed(null);
  };

  const unplaceToken = (tokenId: string) => {
    if (!isAnswering) return;
    onValueChange(removeEverywhere(value, tokenId));
  };

  const borderFor = (base: string) =>
    reveal && ok === true
      ? 'var(--ssz-feedback-ok-line)'
      : reveal && ok === false
        ? 'var(--ssz-feedback-no-line)'
        : base;

  return (
    <>
      <Instr>{content.instruction ?? t('sentenceSchema.defaultInstruction')}</Instr>

      <p
        className="mb-4 leading-[1.5]"
        style={{ fontFamily: READING, fontSize: 20, fontWeight: 500, color: 'var(--ssz-text-primary)' }}
      >
        {content.sentence}
      </p>

      {/* Field columns */}
      <div className="mb-4 overflow-x-auto">
        <div className="flex min-w-max gap-2">
          {content.fields.map((field) => {
            const tokenIds = value[field.id] ?? [];
            return (
              <div key={field.id} className="flex min-w-28 flex-1 flex-col">
                <p
                  className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: 'var(--ssz-text-muted)' }}
                >
                  {field.label}
                </p>
                <button
                  type="button"
                  disabled={!isAnswering || armed === null}
                  onClick={() => placeInField(field.id)}
                  aria-label={t('sentenceSchema.fieldDropLabel', { field: field.label })}
                  style={{
                    minHeight: 56,
                    borderRadius: 10,
                    border: `2px dashed ${borderFor('var(--ssz-border-default)')}`,
                    background: armed !== null && isAnswering ? accentSoft : 'var(--ssz-bg-subtle)',
                    padding: 6,
                    cursor: isAnswering && armed !== null ? 'pointer' : 'default',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    alignContent: 'flex-start',
                    justifyContent: 'center',
                  }}
                >
                  {tokenIds.map((id) => (
                    <span
                      key={id}
                      role="button"
                      tabIndex={isAnswering ? 0 : -1}
                      onClick={(e) => {
                        e.stopPropagation();
                        unplaceToken(id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          unplaceToken(id);
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: `2px solid ${accent}`,
                        background: 'var(--ssz-bg-surface)',
                        color: 'var(--ssz-text-primary)',
                        fontFamily: READING,
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: isAnswering ? 'pointer' : 'default',
                      }}
                    >
                      {tokenById.get(id)?.text ?? ''}
                    </span>
                  ))}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Token bank */}
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--ssz-text-muted)' }}>
        {t('sentenceSchema.bankLabel')}
      </p>
      <div className="flex flex-wrap gap-2" aria-label={t('sentenceSchema.bankLabel')}>
        {bank.length === 0 && (
          <span className="text-[13px] italic" style={{ color: 'var(--ssz-text-muted)' }}>
            {t('sentenceSchema.bankEmpty')}
          </span>
        )}
        {bank.map((tk) => {
          const isArmed = armed === tk.id;
          return (
            <button
              key={tk.id}
              type="button"
              disabled={!isAnswering}
              aria-pressed={isArmed}
              onClick={() => isAnswering && setArmed(isArmed ? null : tk.id)}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                border: `2px solid ${isArmed ? accent : 'var(--ssz-border-default)'}`,
                background: isArmed ? accentSoft : 'var(--ssz-bg-surface)',
                color: isArmed ? accent : 'var(--ssz-text-primary)',
                fontFamily: READING,
                fontSize: 16,
                fontWeight: 600,
                cursor: isAnswering ? 'pointer' : 'default',
              }}
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ssz-border-focus)]"
            >
              {tk.text}
            </button>
          );
        })}
      </div>
    </>
  );
}
