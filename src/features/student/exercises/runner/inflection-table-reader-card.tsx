'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { StudentProjection } from '@/lib/shared-kernel/inflection-table';

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';
const READING = 'var(--ssz-font-reading)';

/** The prototype's `ReaderCard` shows the first three rows (§7.8). */
const PREVIEW_ROWS = 3;

export interface InflectionTableReaderCardProps {
  projection: StudentProjection;
  /** The exercise's title, from the lesson it sits in — the projection carries none. */
  title?: string;
  onStart: () => void;
  /** False in the builder's preview: the card is drawn, the button does nothing. */
  interactive?: boolean;
  accent: string;
}

/**
 * How an inflection table appears in the lesson before it is opened — plan 69, Q4-A.
 *
 * The paradigm chip, the title, a static grid of the first three rows with the short slot
 * labels (given forms as text, asked cells as empty boxes) and the size of the task. Never a
 * key: the card is drawn from the student projection, and an asked cell has nothing in it to
 * show. The one addition to the prototype is the start button — without it the card would be
 * a dead end in the product — and, as for the dictation card, starting is a press, so the
 * attempt opens only then.
 */
export function InflectionTableReaderCard({
  projection,
  title,
  onStart,
  interactive = true,
  accent,
}: InflectionTableReaderCardProps) {
  const t = useTranslations('ExerciseRunner.inflectionTable');
  const heading = title === undefined || title.trim() === '' ? t('defaultTitle') : title;

  const asked = projection.rows.reduce(
    (n, row) => n + Object.values(row.cells).filter((cell) => cell.mode === 'ask').length,
    0,
  );

  return (
    <section
      aria-label={heading}
      className="flex w-full flex-col gap-2.5 rounded-(--ssz-radius-md) border p-(--ssz-space-4)"
      style={{
        maxWidth: 420,
        background: 'var(--ssz-bg-surface)',
        borderColor: 'var(--ssz-border-default)',
        boxShadow: 'var(--ssz-shadow-xs)',
      }}
    >
      <div className="flex items-center gap-2">
        {projection.paradigm.label !== '' && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
            style={{
              fontFamily: 'var(--ssz-font-mono)',
              background: 'var(--ssz-color-primary-100)',
              color: 'var(--ssz-color-primary-700)',
            }}
          >
            {projection.paradigm.label}
          </span>
        )}
        <b className="text-base">{heading}</b>
      </div>

      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{projection.paradigm.lemmaLabel}</span>
            </th>
            {projection.slots.map((slot) => (
              <th
                key={slot.id}
                scope="col"
                className="whitespace-nowrap px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-(--ssz-text-muted)"
              >
                {slot.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projection.rows.slice(0, PREVIEW_ROWS).map((row) => (
            <tr key={row.id}>
              <th
                scope="row"
                className="whitespace-nowrap border-t py-2 pl-0 pr-2.5 text-left"
                style={{ borderColor: 'var(--ssz-border-default)' }}
              >
                <b
                  className="block text-base font-semibold"
                  style={{ fontFamily: READING }}
                  lang={projection.language || undefined}
                >
                  {row.lemma}
                </b>
              </th>
              {projection.slots.map((slot) => {
                const cell = row.cells[slot.id];
                return (
                  <td
                    key={slot.id}
                    className="border-t py-1.5 pl-0 pr-1.5"
                    style={{ borderColor: 'var(--ssz-border-default)' }}
                  >
                    {cell?.mode === 'prefill' ? (
                      <span
                        className="inline-block px-1 py-[7px] text-base text-(--ssz-text-muted)"
                        style={{ fontFamily: READING }}
                      >
                        {cell.value}
                      </span>
                    ) : cell?.mode === 'ask' ? (
                      <span
                        aria-hidden="true"
                        className="inline-block"
                        style={{
                          minWidth: 64,
                          minHeight: 30,
                          border: '1px solid var(--ssz-border-strong)',
                          borderBottomWidth: 2,
                          borderRadius: 'var(--ssz-radius-sm)',
                          background: 'var(--ssz-bg-subtle)',
                        }}
                      />
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="m-0 text-[11px] text-(--ssz-text-muted)">
        {t('card.cells', { n: asked })} · {t('card.lemmas', { n: projection.rows.length })}
      </p>

      <button
        type="button"
        onClick={onStart}
        disabled={!interactive}
        className={`inline-flex items-center gap-2 self-start rounded-(--ssz-radius-sm) px-4 py-2.5 text-sm font-semibold text-white disabled:pointer-events-none ${FOCUS}`}
        style={{ background: accent, minHeight: 44 }}
      >
        {t('card.start')}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </section>
  );
}
