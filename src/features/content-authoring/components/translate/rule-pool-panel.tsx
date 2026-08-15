'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  useAttachExerciseToRule,
  useDetachExerciseFromRule,
  useExerciseRuleLinks,
  useSetRulePoolWeight,
} from '@/features/content-authoring/api';
import type { LevelGrammarRule } from '@/features/content-authoring/lib/level-grammar-rules';

/**
 * How often the review queue should pick this exercise for the rule, in words rather than
 * in numbers: the scale content-service accepts runs to 100, and a teacher choosing "×37"
 * is a teacher who has been handed a dial with no marks on it.
 */
const WEIGHTS = [
  { value: 0.5, name: 'rare' },
  { value: 1, name: 'normal' },
  { value: 2, name: 'often' },
] as const;

export interface RulePoolPanelProps {
  exerciseId: string;
  /** The rules of this Leksjon, from the curriculum tree the editor route already loaded. */
  rules: LevelGrammarRule[];
}

/**
 * "What does this practise" — the exercise's place in the review queue of a grammar rule.
 *
 * It writes to the pool relation in content-service rather than into the exercise document
 * (plan 42, "Привязка к грамматическому правилу"): rule ↔ exercise with a position and a
 * weight already exists as a relation with its own commands, and a copy in `content` would
 * be a second source of truth about the same fact.
 *
 * The line that matters is the one under the heading. An attached exercise comes back on
 * its own through spaced repetition for as long as the rule is being learnt; an unattached
 * one is asked once, where it sits in the lesson. That is the whole difference, and it is
 * said in a sentence rather than hidden in a tooltip.
 */
export function RulePoolPanel({ exerciseId, rules }: RulePoolPanelProps) {
  const t = useTranslations('Authoring');
  const [search, setSearch] = useState('');

  const { data: links = [], isLoading, isError } = useExerciseRuleLinks(exerciseId);
  const attach = useAttachExerciseToRule(exerciseId);
  const setWeight = useSetRulePoolWeight(exerciseId);
  const detach = useDetachExerciseFromRule(exerciseId);

  const attached = new Set(links.map((link) => link.ruleId));
  const needle = search.trim().toLowerCase();
  const candidates = rules
    .filter((rule) => !attached.has(rule.id))
    .filter((rule) => needle === '' || rule.title.toLowerCase().includes(needle));

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="flex items-center gap-1.5 text-xs font-medium">
          <BookOpen className="size-3.5" aria-hidden />
          {t('translate.pool.title')}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('translate.pool.lede')}</p>
      </div>

      {isError ? (
        <p className="rounded-md border border-border px-3 py-2 text-xs text-error" role="status">
          {t('translate.pool.loadFailed')}
        </p>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground">{t('translate.pool.loading')}</p>
      ) : links.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          {t('translate.pool.none')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li
              key={link.ruleId}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <span className="min-w-40 flex-1">
                <span className="block text-sm font-medium">{link.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {link.subtopic ?? link.topic} · {link.difficultyLevel}
                </span>
              </span>

              <Segmented
                size="sm"
                aria-label={t('translate.pool.weightLabel', { rule: link.title })}
                value={String(nearestWeight(link.weight))}
                onValueChange={(value) =>
                  setWeight.mutate({ ruleId: link.ruleId, weight: Number(value) })
                }
                options={WEIGHTS.map((step) => ({
                  value: String(step.value),
                  label: t(`translate.pool.weight.${step.name}` as 'translate.pool.weight.normal'),
                }))}
              />

              <button
                type="button"
                aria-label={t('translate.pool.detach', { rule: link.title })}
                title={t('translate.pool.detach', { rule: link.title })}
                onClick={() => detach.mutate({ ruleId: link.ruleId })}
                className="flex size-8 items-center justify-center rounded-md border border-border hover:bg-[var(--ssz-bg-subtle)]"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* The rules of this Leksjon, which is the scope an exercise is written inside. A
          course-wide search would offer rules from a Leksjon the student has not reached. */}
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('translate.pool.noRules')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            value={search}
            aria-label={t('translate.pool.searchLabel')}
            placeholder={t('translate.pool.searchPlaceholder')}
            onChange={(event) => setSearch(event.target.value)}
          />
          {candidates.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('translate.pool.noMatches')}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {candidates.map((rule) => (
                <li key={rule.id}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={attach.isPending}
                    onClick={() => attach.mutate({ ruleId: rule.id })}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    {rule.title}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** The stored weight can be any number in 0.01–100; the control shows the rung nearest it. */
function nearestWeight(weight: number): number {
  return WEIGHTS.reduce((closest, step) =>
    Math.abs(step.value - weight) < Math.abs(closest.value - weight) ? step : closest,
  ).value;
}
