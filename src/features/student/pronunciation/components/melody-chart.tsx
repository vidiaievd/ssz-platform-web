import { useTranslations } from 'next-intl';

import type { Melody } from '../types';

const W = 320;
const H = 120;
const PAD = 8;

/** Runs of consecutive voiced samples as `M x y L x y …` paths; a gap in the voice is a gap in the line. */
function paths(curve: ReadonlyArray<number | null>, x: (i: number) => number, y: (v: number) => number): string[] {
  const out: string[] = [];
  let run: string[] = [];
  curve.forEach((v, i) => {
    if (v === null) {
      if (run.length > 1) out.push(run.join(' '));
      run = [];
      return;
    }
    run.push(`${run.length === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
  });
  if (run.length > 1) out.push(run.join(' '));
  return out;
}

/**
 * The learner's pitch against the model's (plan 86, step 16.4): two lines on one scale, the model
 * dashed so the difference does not rest on colour. Each line is stretched over the width of the
 * word — the question is the shape of the melody, not how long it took.
 */
export function MelodyChart({ melody }: { melody: Melody }) {
  const t = useTranslations('Pronunciation.melody');
  const all = [...melody.learner, ...melody.reference].filter((v): v is number => v !== null);
  if (all.length < 2) return <p className="text-sm text-(--ssz-text-muted)">{t('none')}</p>;

  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - 2 * PAD);
  const xOf = (n: number) => (i: number) => PAD + (n <= 1 ? 0 : (i / (n - 1)) * (W - 2 * PAD));

  const yours = paths(melody.learner, xOf(melody.learner.length), y);
  const model = paths(melody.reference, xOf(melody.reference.length), y);

  return (
    <figure className="flex flex-col gap-1">
      <svg role="img" aria-label={t('label')} viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm rounded-(--ssz-radius-sm) border border-(--ssz-border-default)">
        {model.map((d, i) => (
          <path key={`m${i}`} d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="5 4" className="text-(--ssz-text-muted)" />
        ))}
        {yours.map((d, i) => (
          <path key={`y${i}`} d={d} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" className="text-(--ssz-color-primary-600)" />
        ))}
      </svg>
      <figcaption className="flex gap-4 text-xs text-(--ssz-text-muted)">
        <span>— {t('yours')}</span>
        <span>- - {t('model')}</span>
      </figcaption>
    </figure>
  );
}
