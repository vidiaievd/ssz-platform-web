'use client';

import { useState } from 'react';
import { Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useExerciseAxes, useSetExerciseAxes } from '../api/use-exercise-axes';
import {
  COVERAGE_FOCUSES,
  COVERAGE_SKILLS,
  type CoverageFocus,
  type CoverageSkill,
} from '../types';

function sameSet<T extends string>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function Chip({
  label,
  pressed,
  onClick,
  disabled,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50',
        pressed
          ? 'border-primary bg-primary/10 font-semibold text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

interface ExerciseAxesPanelProps {
  exerciseId: string;
  /** The container the exercise is placed in, whose exercise list is refetched after a save. */
  containerId?: string;
}

/**
 * What this exercise trains — and, above all, where that answer came from.
 *
 * The derivation gets the whole seeded catalogue right without anyone tagging it, so the
 * panel is an escape hatch rather than a required step: it opens already filled in, and
 * an author who agrees with it has nothing to do here.
 *
 * The two acts the service keeps apart are kept apart on screen. Saving an empty pair
 * says "this exercise counts towards nothing" — a warm-up, deliberately outside the
 * report. Withdrawing the override says "you decide again", and gives back the derived
 * value rather than an empty one. Collapsing them into one button would make the first
 * unreachable and the second a lie.
 *
 * The axes are their own resource with their own routes, so this saves on its own and
 * the form's "Save" below has nothing to do with it.
 */
export function ExerciseAxesPanel({ exerciseId, containerId }: ExerciseAxesPanelProps) {
  const t = useTranslations('Authoring.axes');
  const tAxis = useTranslations('Authoring.coverage');
  const { data, isLoading, isError } = useExerciseAxes(exerciseId);
  const mutation = useSetExerciseAxes(exerciseId, containerId);

  // Only what the author has touched lives here; everything else is read from the
  // server's answer. Dropping the draft is therefore all a save has to do — including a
  // withdrawal, after which the panel must show what the exercise trains again rather
  // than the selection it replaced.
  const [draft, setDraft] = useState<{ skills: CoverageSkill[]; focus: CoverageFocus[] } | null>(
    null,
  );

  if (isLoading) return <Skeleton className="h-28 w-full" />;
  if (isError || !data) return <p className="text-xs text-destructive">{t('loadError')}</p>;

  const skills = draft?.skills ?? data.skills;
  const focus = draft?.focus ?? data.focus;

  const setSkills = (next: (previous: CoverageSkill[]) => CoverageSkill[]) =>
    setDraft({ skills: next(skills), focus });
  const setFocus = (next: (previous: CoverageFocus[]) => CoverageFocus[]) =>
    setDraft({ skills, focus: next(focus) });

  const dirty = draft !== null && (!sameSet(skills, data.skills) || !sameSet(focus, data.focus));
  const overridden = data.skillSource === 'override' || data.focusSource === 'override';
  const busy = mutation.isPending;

  async function save(next: { skills: CoverageSkill[]; focus: CoverageFocus[] } | null) {
    try {
      await mutation.mutateAsync(next);
      setDraft(null);
      toast.success(next === null ? t('withdrawn') : t('saved'));
    } catch {
      toast.error(t('saveError'));
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Target className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-bold tracking-wide text-muted-foreground">{t('title')}</span>
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {tAxis('axis.skill')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {COVERAGE_SKILLS.map((skill) => (
            <Chip
              key={skill}
              label={tAxis(`skill.${skill}` as 'skill.listening')}
              pressed={skills.includes(skill)}
              disabled={busy}
              onClick={() =>
                setSkills((prev) =>
                  prev.includes(skill)
                    ? prev.filter((value) => value !== skill)
                    : COVERAGE_SKILLS.filter((value) => value === skill || prev.includes(value)),
                )
              }
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t(`source.${data.skillSource}` as 'source.template')}
        </p>
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {tAxis('axis.focus')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {COVERAGE_FOCUSES.map((value) => (
            <Chip
              key={value}
              label={tAxis(`focus.${value}` as 'focus.vocabulary')}
              pressed={focus.includes(value)}
              disabled={busy}
              onClick={() =>
                setFocus((prev) =>
                  prev.includes(value)
                    ? prev.filter((entry) => entry !== value)
                    : COVERAGE_FOCUSES.filter((entry) => entry === value || prev.includes(entry)),
                )
              }
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t(`source.${data.focusSource}` as 'source.template')}
        </p>
      </div>

      {/* Read-only: the form is a property of how the document is answered, not a label
          anyone may reassign. It is shown because it is the row of the coverage report an
          author is most likely to be surprised by. */}
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{tAxis('axis.form')}</span>
        <b className="font-semibold text-foreground">{tAxis(`form.${data.form}` as 'form.bank')}</b>
      </div>

      {skills.length === 0 && focus.length === 0 && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t('emptyHint')}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || busy}
          loading={busy && dirty}
          onClick={() => void save({ skills, focus })}
        >
          {t('save')}
        </Button>
        {overridden && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void save(null)}
          >
            {t('withdraw')}
          </Button>
        )}
      </div>
    </section>
  );
}
