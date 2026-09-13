import { Compass } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { getMasteryProfile } from '@/features/mastery/api/get-mastery-profile';
import { splitVerdicts } from '@/features/mastery/lib/split-verdicts';
import type { MasteryCell, MasteryUncertainCell, MasteryVerdict } from '@/features/mastery/types';
import { cn } from '@/lib/utils';

type Translate = Awaited<ReturnType<typeof getTranslations<'Mastery'>>>;

/** Three, as everywhere else on the learner's side: a list that scrolls is a list nobody acts on. */
const MAX_ROWS = 3;

interface Row {
  key: string;
  name: string;
  body: string;
}

/**
 * How a pair is named to the learner — the skill when it is known, otherwise the subject.
 *
 * Never "Not recorded × Not recorded". On the teacher's screen that pair is a finding
 * about the course; here it would only be the platform admitting what it does not know,
 * which tells a student nothing they can act on.
 */
function name(cell: MasteryCell, t: Translate): string | null {
  if (cell.skill !== 'unknown') return t(`skill.${cell.skill}` as 'skill.listening');
  if (cell.focus !== 'unknown') return t(`focus.${cell.focus}` as 'focus.vocabulary');
  return null;
}

/**
 * "Worth a look this week" — the learner's half of screen E's question, plan 58 §3.6.
 *
 * Two things separate it from the block on the home screen. It says **why** a pair is
 * listed, in a sentence rather than a number: forgetting something a week after learning
 * it and never having learnt it are opposite problems with the same score, and only one
 * of them is fixed by more practice.
 *
 * And it shows pairs with **too little evidence** — which the home block deliberately
 * hides — worded as an action rather than as a shortfall. "We do not know enough about
 * you yet" is not feedback; "three more and this turns into real feedback" is the same
 * fact pointed at something the learner can do. The threshold itself is never shown.
 */
export async function WorthALook({ userId, className }: { userId: string; className?: string }) {
  const profile = await getMasteryProfile(userId);
  if (!profile) return null;

  const t = await getTranslations('Mastery');
  const { weak } = splitVerdicts(profile.weakest);

  const rows: Row[] = [
    ...weak.map((verdict) => weakRow(verdict, t)),
    // Thin cells come after the weak ones and only fill the space they leave: a learner
    // with three real things to work on does not need to hear about a fourth we cannot
    // judge yet.
    ...profile.insufficient.map((cell) => thinRow(cell, t)),
  ]
    .filter((row): row is Row => row !== null)
    .slice(0, MAX_ROWS);

  if (rows.length === 0) return null;

  return (
    <section
      className={cn(
        'rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface p-4.5 shadow-(--ssz-shadow-xs)',
        className,
      )}
      aria-label={t('worthALook.title')}
    >
      <div className="mb-3 flex items-center gap-2.25">
        <Compass size={18} className="text-(--ssz-text-secondary)" aria-hidden="true" />
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-(--ssz-text-primary)">
          {t('worthALook.title')}
        </h2>
      </div>

      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.key}>
            <p className="text-[13.5px] font-bold text-(--ssz-text-primary)">{row.name}</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-(--ssz-text-secondary)">
              {row.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function weakRow(verdict: MasteryVerdict, t: Translate): Row | null {
  const label = name(verdict, t);
  if (label === null) return null;

  // `watch` is "listed because something has to come first", not a problem — said as
  // such, rather than dressed up as one. An unknown reason gets the one honest sentence
  // there is: the pair is shaky and nothing recorded says why.
  const reason = verdict.reason ?? 'unknown';

  return {
    key: `weak-${verdict.skill}-${verdict.focus}`,
    name: label,
    body: t(`worthALook.reason.${reason}` as 'worthALook.reason.forgets'),
  };
}

function thinRow(cell: MasteryUncertainCell, t: Translate): Row | null {
  const label = name(cell, t);
  if (label === null) return null;

  return {
    key: `thin-${cell.skill}-${cell.focus}`,
    name: label,
    body: t('worthALook.thin'),
  };
}
