'use client';

import { useTranslations } from 'next-intl';

/** Verdict for one analysed option in the rationale matrix. */
export type RationaleVerdict = 'correct' | 'acceptable' | 'wrong';

export interface RationaleOption {
  text: string;
  verdict: RationaleVerdict;
  note?: string;
}

/**
 * Optional teaching aid shown as feedback AFTER checking: why the correct
 * choice fits and why typical wrong choices don't. Purely presentational —
 * it never takes part in grading.
 */
export interface Rationale {
  explanation?: string;
  options?: RationaleOption[];
}

export interface RationaleMatrixProps {
  rationale: Rationale;
  /** What the learner actually picked; empty when the blank was left open. */
  chosen?: string;
  /** Whether that pick was graded correct — decides a synthesized row's verdict. */
  chosenCorrect?: boolean;
}

const OK_BG = 'var(--ssz-feedback-ok-bg)';
const OK_FG = 'var(--ssz-feedback-ok-fg)';
const NO_BG = 'var(--ssz-feedback-no-bg)';
const NO_FG = 'var(--ssz-feedback-no-fg)';
const READING = 'var(--ssz-font-reading)';

/**
 * Per-verdict colors for the rationale matrix rows. `note` is the color of the
 * explanatory column: on a tinted row the muted secondary tone loses too much
 * contrast, so those rows fall back to the primary text color.
 */
function verdictStyle(verdict: RationaleVerdict): {
  mark: string;
  color: string;
  bg: string;
  note: string;
} {
  if (verdict === 'correct')
    return { mark: '✔', color: OK_FG, bg: OK_BG, note: 'var(--ssz-text-primary)' };
  if (verdict === 'acceptable')
    return {
      mark: '△',
      color: 'var(--ssz-text-secondary)',
      bg: 'var(--ssz-bg-surface)',
      note: 'var(--ssz-text-secondary)',
    };
  return { mark: '✗', color: NO_FG, bg: NO_BG, note: 'var(--ssz-text-primary)' };
}

const norm = (s: string) => s.trim().toLowerCase();

interface Row extends RationaleOption {
  /** True for the option the learner actually picked. */
  mine: boolean;
  /** True when the row was added because the author never analysed this pick. */
  synthesized: boolean;
}

/**
 * Authors analyse a handful of likely traps, not the whole word bank, so a
 * learner can easily pick an option no row covers — and then the matrix reads
 * as an explanation of somebody else's answer. Guarantee a wrong pick is always
 * represented, and lift it next to the correct row where the contrast is
 * visible: correct first (that's the rule being taught), the learner's pick
 * second, the remaining authored options after.
 *
 * A correct pick is never synthesized: the authored `correct` row already says
 * everything a second green row would, and two of them read as two answers.
 */
export function buildRationaleRows(
  options: RationaleOption[],
  chosen: string,
  chosenCorrect: boolean,
): Row[] {
  const picked = norm(chosen);
  const rows: Row[] = options.map((o) => ({
    ...o,
    mine: picked !== '' && norm(o.text) === picked,
    synthesized: false,
  }));

  if (picked !== '' && !chosenCorrect && !rows.some((r) => r.mine)) {
    rows.push({ text: chosen, verdict: 'wrong', mine: true, synthesized: true });
  }

  const rank = (r: Row) => (r.verdict === 'correct' ? 0 : r.mine ? 1 : 2);
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => rank(a.row) - rank(b.row) || a.i - b.i)
    .map(({ row }) => row);
}

/**
 * Post-check teaching aid: a compact table of the candidate answers with a
 * verdict and a short note for each. Rendered under the sentence in the
 * feedback phase so the student learns the rule, not just the answer.
 */
export function RationaleMatrix({ rationale, chosen = '', chosenCorrect = false }: RationaleMatrixProps) {
  const t = useTranslations('ExerciseRunner');
  const options = rationale.options ?? [];
  if (options.length === 0 && !rationale.explanation) return null;

  // A lone explanation stays a paragraph — never grow a one-row table out of it.
  const rows = options.length > 0 ? buildRationaleRows(options, chosen, chosenCorrect) : [];

  const verdictLabel: Record<RationaleVerdict, string> = {
    correct: t('fill.verdictCorrect'),
    acceptable: t('fill.verdictAcceptable'),
    wrong: t('fill.verdictWrong'),
  };
  // Only ever needed by a synthesized row, and those are always `wrong`.
  const fallbackNote = t('fill.chosenWrongNote');

  return (
    <section
      className="mt-7 rounded-xl border p-4"
      style={{
        borderColor: 'var(--ssz-border-default)',
        background: 'var(--ssz-bg-subtle)',
      }}
      aria-label={t('fill.rationaleTitle')}
    >
      <h3
        className="mb-3 text-[13px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--ssz-text-secondary)', fontFamily: 'var(--ssz-font-ui)' }}
      >
        {t('fill.rationaleTitle')}
      </h3>

      {rationale.explanation && (
        <p
          className="mb-3 text-[15px] leading-relaxed"
          style={{ color: 'var(--ssz-text-primary)', fontFamily: READING }}
        >
          {rationale.explanation}
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          {/* border-separate + row spacing: each verdict row reads as its own
              rounded, padded chip rather than a full-bleed table band. */}
          <table
            className="w-full border-separate text-left text-[14px]"
            style={{ borderSpacing: '0 6px' }}
          >
            <thead>
              <tr style={{ color: 'var(--ssz-text-muted)' }}>
                <th scope="col" className="px-3 py-1 font-medium">
                  {t('fill.optionHeader')}
                </th>
                <th scope="col" className="px-3 py-1 font-medium">
                  {t('fill.verdictHeader')}
                </th>
                <th scope="col" className="px-3 py-1 font-medium">
                  {t('fill.noteHeader')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((opt) => {
                const s = verdictStyle(opt.verdict);
                return (
                  <tr key={opt.text}>
                    <td
                      className="px-3 py-2.5 align-top font-semibold"
                      style={{
                        fontFamily: READING,
                        color: s.color,
                        background: s.bg,
                        borderRadius: '10px 0 0 10px',
                      }}
                    >
                      {opt.text}
                      {opt.mine && (
                        <span
                          className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide"
                          style={{
                            color: 'var(--ssz-text-secondary)',
                            fontFamily: 'var(--ssz-font-ui)',
                          }}
                        >
                          {t('fill.yourAnswer')}
                        </span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2.5 align-top whitespace-nowrap"
                      style={{ color: s.color, background: s.bg }}
                    >
                      <span aria-hidden="true">{s.mark}</span>{' '}
                      <span className="text-[13px]">{verdictLabel[opt.verdict]}</span>
                    </td>
                    <td
                      className="px-3 py-2.5 align-top"
                      style={{
                        color: s.note,
                        background: s.bg,
                        borderRadius: '0 10px 10px 0',
                      }}
                    >
                      {opt.note ?? (opt.synthesized ? fallbackNote : undefined)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
