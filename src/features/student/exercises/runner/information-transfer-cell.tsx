'use client';

import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AudioSegmentButton, type ExerciseAudioEngine } from '@/features/student/exercises/audio';
import type { FieldType, ProjectedField } from '@/lib/shared-kernel/information-transfer';
import { passes } from '@/lib/shared-kernel/information-transfer';
import type { InformationTransferItemResult } from '@/features/student/exercises/types/attempts';

const READING = 'var(--ssz-font-reading)';
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

/** How the field is drawn — the prototype's `data-s`. */
type CellState = 'empty' | 'filled' | 'ok' | 'bad';

export interface InformationTransferCellProps {
  field: ProjectedField;
  /** The label when the author left none: «Felt N». */
  position: number;
  language: string;
  value: string;
  onChange: (value: string) => void;
  /** What the last check said of this cell; `undefined` before it and after a retry. */
  outcome?: InformationTransferItemResult;
  /** Frozen by the server: right on an earlier check. */
  locked: boolean;
  /** False while sending, after a check, in a preview or behind the audio gate. */
  canEdit: boolean;
  /** One column — the `table` layout or a narrow surface. */
  stacked: boolean;
  audio?: ExerciseAudioEngine;
  interactive: boolean;
}

/**
 * One field of the blank — the prototype's `INFCell`: label and hint, the input in the reading
 * font with the pack's placeholder, the unit, the verdict mark, and under it the standard form,
 * the key (only where the server sent it) or the author's reason.
 *
 * Nothing here knows an expected value. The mark, the colour and every line under the input are
 * read off the outcome the server returned; a cell without an outcome is only ever «empty» or
 * «filled».
 */
export function InformationTransferCell({
  field,
  position,
  language,
  value,
  onChange,
  outcome,
  locked,
  canEdit,
  stacked,
  audio,
  interactive,
}: InformationTransferCellProps) {
  const t = useTranslations('ExerciseRunner.informationTransfer');

  const state: CellState =
    locked || outcome?.correct === true
      ? 'ok'
      : outcome !== undefined
        ? 'bad'
        : value.trim() !== ''
          ? 'filled'
          : 'empty';
  const label = field.label.trim() !== '' ? field.label : t('fieldN', { n: position });
  const hint = outcome?.hint ?? field.hint;
  const segment =
    audio !== undefined && audio.audio.enabled ? (audio.segments[field.id] ?? null) : null;

  // Right and wrong ride in the mark's text and the strike-through as well as the colour.
  let markText: string | null = null;
  if (outcome !== undefined) {
    switch (outcome.verdict) {
      case 'ok':
      case 'format':
        markText = t('mark.ok');
        break;
      case 'typo':
        markText = t('mark.typo');
        break;
      case 'unread':
        markText = t('mark.unread');
        break;
      case 'empty':
        markText = t('mark.empty');
        break;
      case 'wrong':
        markText = t('mark.wrong');
        break;
    }
  }
  const ok = outcome !== undefined && passes(outcome.verdict);

  return (
    <div
      className="grid items-start gap-2.5"
      style={{
        gridTemplateColumns: stacked ? 'minmax(0, 1fr)' : 'minmax(90px, .8fr) minmax(0, 1.2fr)',
      }}
    >
      <label
        htmlFor={`inf-${field.id}`}
        className="flex flex-col text-sm font-medium text-(--ssz-text-secondary)"
        style={{ paddingTop: stacked ? 0 : 9 }}
      >
        {label}
        {hint !== undefined && hint !== '' && (
          <em className="text-[11px] font-normal not-italic text-(--ssz-text-muted)">{hint}</em>
        )}
      </label>

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-[7px]">
          <input
            id={`inf-${field.id}`}
            value={value}
            disabled={!canEdit || locked}
            placeholder={field.placeholder}
            inputMode={field.numeric ? 'numeric' : 'text'}
            data-s={state}
            aria-label={markText === null ? label : `${label}, ${markText}`}
            onChange={(event) => onChange(event.target.value)}
            // Autocorrect would repair exactly what is being read off the source.
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            lang={language || undefined}
            className={`min-w-0 flex-1 ${FOCUS}`}
            style={inputStyle(state)}
          />
          {field.unit !== '' && (
            <span
              className="text-xs text-(--ssz-text-muted)"
              style={{ fontFamily: 'var(--ssz-font-mono)' }}
            >
              {field.unit}
            </span>
          )}
          {markText !== null && (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold"
              style={{
                color: ok ? 'var(--ssz-color-success-700)' : 'var(--ssz-color-error-700)',
              }}
            >
              {ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
              {markText}
            </span>
          )}
        </div>

        {segment !== null && audio !== undefined && (
          // Free, always: a fragment spends no listen.
          <span className="[&>button]:mt-0">
            <AudioSegmentButton
              eng={audio}
              segment={segment}
              disabled={!interactive || audio.gated}
            />
          </span>
        )}

        {outcome !== undefined && <Under outcome={outcome} type={field.type} />}
      </div>
    </div>
  );
}

/** The lines under a checked cell: the standard form, the unread note, the key, the reason. */
function Under({ outcome, type }: { outcome: InformationTransferItemResult; type: FieldType }) {
  const t = useTranslations('ExerciseRunner.informationTransfer');
  const canonical = outcome.canonical;
  // One explicit branch per format type — a dynamic key would crash the type checker.
  let unreadNote = '';
  switch (type) {
    case 'time':
      unreadNote = t('hint.unreadTime');
      break;
    case 'date':
      unreadNote = t('hint.unreadDate');
      break;
    case 'number':
      unreadNote = t('hint.unreadNumber');
      break;
    case 'money':
      unreadNote = t('hint.unreadMoney');
      break;
    case 'phone':
      unreadNote = t('hint.unreadPhone');
      break;
    case 'name':
    case 'word':
      // Free text is always readable; the core never returns `unread` for it.
      break;
  }
  return (
    <>
      {outcome.verdict === 'format' && canonical !== undefined && (
        <span className="text-[11px] text-(--ssz-text-muted)">
          {t('hint.format', { form: canonical })}
        </span>
      )}
      {outcome.verdict === 'unread' && (
        <span className="text-[11px] text-(--ssz-text-muted)">{unreadNote}</span>
      )}
      {outcome.verdict !== 'format' && canonical !== undefined && (
        <span className="text-[11px] text-(--ssz-text-muted)">
          {t('hint.answer')} <b style={{ fontFamily: READING }}>{canonical}</b>
        </span>
      )}
      {!outcome.correct && outcome.why !== undefined && (
        <span
          className="rounded-(--ssz-radius-sm) px-[9px] py-[7px] text-xs leading-snug text-(--ssz-text-secondary)"
          style={{
            background: 'var(--ssz-bg-subtle)',
            borderLeft: '2px solid var(--ssz-border-strong)',
          }}
        >
          {outcome.why}
        </span>
      )}
    </>
  );
}

function inputStyle(state: CellState) {
  const base = {
    minHeight: 40,
    padding: '7px 10px',
    border: '1px solid var(--ssz-border-strong)',
    borderBottomWidth: 2,
    borderRadius: 'var(--ssz-radius-sm)',
    background: 'var(--ssz-bg-surface)',
    fontFamily: READING,
    fontSize: 'var(--ssz-text-base)',
    color: 'var(--ssz-text-primary)',
  } as const;
  switch (state) {
    case 'empty':
      return { ...base, background: 'var(--ssz-bg-subtle)' };
    case 'filled':
      return {
        ...base,
        borderColor: 'var(--ssz-color-primary-400)',
        background: 'var(--ssz-color-primary-50)',
      };
    case 'ok':
      return {
        ...base,
        borderColor: 'var(--ssz-color-success-500)',
        background: 'var(--ssz-color-success-50)',
        color: 'var(--ssz-color-success-700)',
      };
    case 'bad':
      return {
        ...base,
        borderColor: 'var(--ssz-color-error-500)',
        background: 'var(--ssz-color-error-50)',
        color: 'var(--ssz-color-error-700)',
      };
  }
}
