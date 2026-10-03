'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangle, Crosshair, Plus, X } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useExerciseRuleLinks } from '../api/use-exercise-rule-pool';
import {
  useAtomsOfRules,
  useExerciseTargets,
  useSetItemTargets,
  useTargetSuggestions,
  type ItemTargetInput,
} from '../api/use-exercise-targets';
import type { ItemTargets, ResolvedTarget, TargetSuggestion } from '../types';
import { EditorCard } from './editor-card';

function asInput(target: ResolvedTarget): ItemTargetInput {
  return { atomType: target.atomType, atomId: target.atomId, role: target.role };
}

/**
 * What each piece of this exercise is about — plan 63, phase 1, as the author sees it.
 *
 * One control for every template. The address lives in a table beside the exercise rather
 * than in its document (§2 D), which is what lets a gap-fill, a pair set and a writing task
 * be addressed by the same panel instead of by thirteen edits to thirteen builders.
 *
 * Three things it insists on saying:
 *
 * - **Every item, addressed or not.** A gap that says nothing about itself is the thing
 *   worth seeing; listing only the addressed ones would hide exactly the work left to do.
 * - **Broken addresses, out loud.** A gap key holds a token index, so editing a sentence
 *   moves it, and a target can end up pointing at a gap that is gone — or at an atom
 *   somebody retired. Both are reported, because a silently dropped target leaves an
 *   author believing a gap is covered when it is not.
 * - **Which rules have not been cut up.** When the suggester has nothing to offer, that is
 *   usually why, and it is the one actionable sentence available.
 */
export function ExerciseTargetsPanel({ exerciseId }: { exerciseId: string }) {
  const t = useTranslations('Authoring.targets');

  const { data, isLoading, isError } = useExerciseTargets(exerciseId);
  const { data: suggestions } = useTargetSuggestions(exerciseId);
  const { data: ruleLinks = [] } = useExerciseRuleLinks(exerciseId);
  const { atoms } = useAtomsOfRules(ruleLinks.map((link) => link.ruleId));
  const save = useSetItemTargets(exerciseId);

  function write(item: ItemTargets, targets: ItemTargetInput[]) {
    save.mutate(
      { itemKey: item.itemKey, targets },
      { onError: () => toast.error(t('saveFailed')) },
    );
  }

  function suggestionsFor(itemKey: string | null): TargetSuggestion[] {
    const item = suggestions?.items.find((candidate) => candidate.itemKey === itemKey);
    return item?.suggestions ?? [];
  }

  return (
    <EditorCard title={t('title')}>
      <p className="mb-3 text-xs text-muted-foreground">{t('lede')}</p>

      {isError ? (
        <p className="rounded-md border border-border px-3 py-2 text-xs text-error" role="status">
          {t('loadFailed')}
        </p>
      ) : isLoading || !data ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((item) => {
            const taken = new Set(item.targets.map((target) => target.atomId));
            const proposals = suggestionsFor(item.itemKey).filter(
              (suggestion) => !taken.has(suggestion.atomId),
            );
            const free = atoms.filter((atom) => !taken.has(atom.id));

            return (
              <div
                key={item.itemKey ?? '#exercise'}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{item.label ?? t('wholeExercise')}</span>
                  {item.targets.length === 0 ? (
                    <span className="text-xs text-muted-foreground">{t('unaddressed')}</span>
                  ) : null}
                </div>

                {item.targets.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {item.targets.map((target) => (
                      <li key={`${target.atomType}:${target.atomId}`}>
                        <span
                          className={cn(
                            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                            target.broken
                              ? 'border-error text-error'
                              : target.role === 'focus'
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border text-muted-foreground',
                          )}
                        >
                          {target.broken ? <AlertTriangle className="size-3" aria-hidden /> : null}
                          <span>{target.atomTitle ?? t('retiredAtom')}</span>
                          <button
                            type="button"
                            className="underline decoration-dotted underline-offset-2"
                            aria-label={t('toggleRole', {
                              atom: target.atomTitle ?? t('retiredAtom'),
                            })}
                            disabled={save.isPending}
                            onClick={() =>
                              write(
                                item,
                                item.targets.map((current) =>
                                  current.atomId === target.atomId
                                    ? {
                                        ...asInput(current),
                                        role: current.role === 'focus' ? 'context' : 'focus',
                                      }
                                    : asInput(current),
                                ),
                              )
                            }
                          >
                            {t(`role.${target.role}` as 'role.focus')}
                          </button>
                          <button
                            type="button"
                            aria-label={t('remove', {
                              atom: target.atomTitle ?? t('retiredAtom'),
                            })}
                            disabled={save.isPending}
                            onClick={() =>
                              write(
                                item,
                                item.targets
                                  .filter((current) => current.atomId !== target.atomId)
                                  .map(asInput),
                              )
                            }
                          >
                            <X className="size-3" aria-hidden />
                          </button>
                        </span>
                        {target.broken ? (
                          <span className="mt-0.5 block text-[11px] text-error">
                            {t(`broken.${target.broken}` as 'broken.item_missing')}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {proposals.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">{t('suggested')}</span>
                    {proposals.map((suggestion) => (
                      <button
                        key={`${suggestion.atomType}:${suggestion.atomId}`}
                        type="button"
                        disabled={save.isPending}
                        onClick={() =>
                          write(item, [
                            ...item.targets.map(asInput),
                            {
                              atomType: suggestion.atomType,
                              atomId: suggestion.atomId,
                              role: suggestion.role,
                            },
                          ])
                        }
                        className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                        title={t(`reason.${suggestion.reason}` as 'reason.word_exact')}
                      >
                        <Plus className="size-3" aria-hidden />
                        {suggestion.title}
                        <span className="text-[11px]">
                          {t(`role.${suggestion.role}` as 'role.focus')}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {free.length > 0 ? (
                  <div className="mt-2">
                    <Select
                      value=""
                      onValueChange={(atomId) =>
                        write(item, [
                          ...item.targets.map(asInput),
                          { atomType: 'grammar_rule_atom', atomId, role: 'focus' },
                        ])
                      }
                    >
                      <SelectTrigger
                        size="sm"
                        className="min-w-56"
                        aria-label={t('addAtom', { item: item.label ?? t('wholeExercise') })}
                      >
                        <SelectValue placeholder={t('addAtom', { item: '' })} />
                      </SelectTrigger>
                      <SelectContent>
                        {free.map((atom) => (
                          <SelectItem key={atom.id} value={atom.id}>
                            {atom.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            );
          })}

          {data.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              {t('noItems')}
            </p>
          ) : null}

          {suggestions && suggestions.rulesWithoutAtoms.length > 0 ? (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Crosshair className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t('rulesWithoutAtoms', {
                rules: suggestions.rulesWithoutAtoms.map((rule) => rule.title).join(', '),
              })}
            </p>
          ) : null}
        </div>
      )}
    </EditorCard>
  );
}
