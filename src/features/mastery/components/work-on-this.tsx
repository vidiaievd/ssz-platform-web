import { Compass } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { cn } from '@/lib/utils';

import { getMasteryProfile } from '../api/get-mastery-profile';
import { splitVerdicts } from '../lib/split-verdicts';
import type { MasteryVerdict } from '../types';

type Translate = Awaited<ReturnType<typeof getTranslations<'Mastery'>>>;

/** At most three: a list of suggestions long enough to scroll is a list nobody acts on. */
const MAX_CELLS = 3;

/**
 * How a cell is named to the learner — the skill if it is known, otherwise the subject.
 *
 * Never "Not recorded · Not recorded": the teacher's card prints that because it is a
 * finding about the course, but to the learner it is only the platform admitting it
 * does not know, which is the thing §6.2 keeps off this screen.
 */
function phrase(verdict: MasteryVerdict, t: Translate): string | null {
  if (verdict.skill !== 'unknown') return t(`skill.${verdict.skill}` as 'skill.listening');
  if (verdict.focus !== 'unknown') return t(`focus.${verdict.focus}` as 'focus.vocabulary');
  return null;
}

type Props = {
  userId: string;
  className?: string;
};

/**
 * "Worth a bit of work" — plan 55 §6.2.
 *
 * Three deliberate silences:
 *
 *  - **No numbers.** A percentage is a grade, and a grade turns practice into a score to
 *    protect. The learner is told what to look at, not how they rank.
 *  - **`insufficient_data` is not shown at all.** "We know nothing about you" is not
 *    feedback; on the teacher's card it is a finding about the course, here it would
 *    only be noise.
 *  - **Nothing at all when there is nothing to say.** The block returns `null` rather
 *    than an encouraging placeholder — an empty card that appears every day teaches the
 *    learner to stop reading the screen.
 */
export async function WorkOnThis({ userId, className }: Props) {
  const profile = await getMasteryProfile(userId);
  if (!profile) return null;

  const { weak } = splitVerdicts(profile.weakest);
  if (weak.length === 0) return null;

  const t = await getTranslations('Mastery');
  const cells = weak
    .map((verdict) => ({ key: `${verdict.skill}-${verdict.focus}`, name: phrase(verdict, t) }))
    .filter((cell): cell is { key: string; name: string } => cell.name !== null)
    .slice(0, MAX_CELLS);

  if (cells.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-lg border-[1.5px] border-(--ssz-border-default) bg-surface p-4.5 shadow-(--ssz-shadow-xs)',
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2.25">
        <Compass size={18} className="text-(--ssz-text-secondary)" aria-hidden="true" />
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-(--ssz-text-primary)">
          {t('student.title')}
        </h2>
      </div>

      <ul className="space-y-1.5">
        {cells.map((cell) => (
          <li
            key={cell.key}
            className="text-[13.5px] font-semibold text-(--ssz-text-primary) before:mr-2 before:text-(--ssz-text-secondary) before:content-['·']"
          >
            {cell.name}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[12.5px] leading-relaxed text-(--ssz-text-secondary)">
        {t('student.subtitle')}
      </p>
    </div>
  );
}
