'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Info, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { MAX_RECIPE_RULES, type RecipePresetId } from '@/lib/shared-kernel/skills';

import type { WorkspaceCoverageRecipe } from '../../types';
import {
  InvalidRecipeError,
  RecipeForbiddenError,
  useSaveWorkspaceCoverageRecipe,
  useWorkspaceCoverageRecipe,
} from '../../api/use-coverage-recipe';
import {
  canon,
  invalidRuleNumbers,
  isDirty,
  matchPreset,
  newRule,
  presetDraft,
  ruleChange,
  toDrafts,
  toRecipe,
  type DraftRule,
} from '../../lib/recipe-draft';
import { RecipeActionBar, type SaveStatus } from './recipe-action-bar';
import { RecipePresets } from './recipe-presets';
import { RecipeRuleCard, ruleAxisId, ruleDeleteId } from './recipe-rule-card';

export type RecipeWorkspaceKind = 'school' | 'solo';

const UNDO_MS = 8_000;
const SAVED_TOAST_MS = 5_000;
const ADD_RULE_ID = 'recipe-add-rule';

/** After an edit: a save in flight keeps going, anything else is over. */
const settle = (status: SaveStatus): SaveStatus => (status === 'saving' ? status : 'idle');

/**
 * The workspace's lesson recipe — plan 65.
 *
 * `recipe: null` (never set) and `{ rules: [] }` (set to ask for nothing) are different
 * states end to end: the first says nothing is checked yet, the second that the workspace
 * chose not to check.
 */
export function WorkspaceRecipeSettings({
  schoolId,
  canEdit,
  kind,
}: {
  schoolId: string;
  canEdit: boolean;
  kind: RecipeWorkspaceKind;
}) {
  const t = useTranslations('Settings.recipe');
  const { data, isPending, isError } = useWorkspaceCoverageRecipe(schoolId);

  if (isError) return <p className="text-[12.5px] text-(--ssz-text-muted)">{t('failed')}</p>;
  if (isPending || !data) return <RecipeSkeleton />;

  return <RecipeEditor schoolId={schoolId} loaded={data} canEdit={canEdit} kind={kind} />;
}

interface Saved {
  /** Null: never set. */
  rules: DraftRule[] | null;
  updatedAt: string | null;
}

/**
 * The editor proper, mounted once the recipe has loaded.
 *
 * What was saved is held here rather than read from the query on every render: the ids of
 * the saved rules must stay the ids of the draft after a save, or every rule would wear a
 * "New" badge the moment it was stored.
 */
function RecipeEditor({
  schoolId,
  loaded,
  canEdit,
  kind,
}: {
  schoolId: string;
  loaded: WorkspaceCoverageRecipe;
  canEdit: boolean;
  kind: RecipeWorkspaceKind;
}) {
  const t = useTranslations('Settings.recipe');
  const tName = useTranslations('Authoring.recipe.editor.preset');
  const format = useFormatter();
  const save = useSaveWorkspaceCoverageRecipe(schoolId);
  const unsaved = useUnsavedChanges();

  const [saved, setSaved] = useState<Saved>(() => ({
    rules: loaded.recipe ? toDrafts(loaded.recipe) : null,
    updatedAt: loaded.updatedAt,
  }));
  /** Null until somebody edits: the saved rules are the draft. */
  const [draft, setDraft] = useState<DraftRule[] | null>(null);
  const [presetId, setPresetId] = useState<RecipePresetId | null>(() =>
    saved.rules ? matchPreset(saved.rules) : null,
  );
  const [status, setStatus] = useState<SaveStatus>('idle');
  /** A 403 on save: the role changed under the page, and it turns read-only. */
  const [forbidden, setForbidden] = useState(false);
  /** Where focus goes once the next render lands — after Add rule or a delete. */
  const pendingFocus = useRef<string | null>(null);

  const editable = canEdit && !forbidden;
  const rules = draft ?? saved.rules ?? [];
  const dirty = isDirty(rules, saved.rules);
  const invalid = invalidRuleNumbers(rules);
  const matched = matchPreset(rules);
  const selected = matched ?? (rules.length > 0 ? presetId : null);

  // The latest draft, for a save that resolves after the author kept typing (BEHAVIOR §5).
  const latest = useRef(rules);
  useEffect(() => {
    latest.current = rules;
  });

  useEffect(() => {
    unsaved?.setDirty(editable && dirty);
  }, [unsaved, editable, dirty]);
  useEffect(() => () => unsaved?.setDirty(false), [unsaved]);

  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  const savedAt = saved.updatedAt
    ? format.dateTime(new Date(saved.updatedAt), { dateStyle: 'medium' })
    : null;

  /** Every edit goes through here: a saved or failed status is over once the rules move. */
  const edit = (next: DraftRule[]) => {
    setDraft(next);
    setStatus(settle);
  };

  const undoable = (message: string) => {
    const snapshot = { draft, presetId };
    toast(message, {
      duration: UNDO_MS,
      action: {
        label: t('toast.undo'),
        onClick: () => {
          setDraft(snapshot.draft);
          setPresetId(snapshot.presetId);
          setStatus(settle);
        },
      },
    });
  };

  const pickPreset = (id: RecipePresetId) => {
    if (matched === id) return;
    const name = tName(id);
    if (rules.length > 0) undoable(t('toast.replaced', { preset: name }));
    else toast(t('toast.added', { preset: name }));
    edit(presetDraft(id));
    setPresetId(id);
  };

  const addRule = () => {
    const rule = newRule();
    edit([...rules, rule]);
    pendingFocus.current = ruleAxisId(rule);
  };

  const deleteRule = (index: number) => {
    undoable(t('toast.deleted', { n: index + 1 }));
    const next = rules.filter((_, i) => i !== index);
    edit(next);
    const after = next[index];
    pendingFocus.current = after ? ruleDeleteId(after) : ADD_RULE_ID;
  };

  const discard = () => {
    toast.dismiss();
    setDraft(null);
    setPresetId(saved.rules ? matchPreset(saved.rules) : null);
    setStatus('idle');
  };

  const submit = () => {
    if (status === 'saving' || invalid.length > 0) return;
    if (!dirty && status !== 'error') return;
    const recipe = toRecipe(rules);
    if (!recipe) return;

    const sent = rules;
    toast.dismiss();
    setStatus('saving');
    save.mutate(recipe, {
      onSuccess: (stored) => {
        setSaved({ rules: sent, updatedAt: stored.updatedAt });
        // Edited while it was in flight: what was sent is saved, the rest is still a draft.
        if (canon(latest.current) === canon(sent)) {
          setDraft(null);
          setStatus('saved');
          toast.success(t('toast.saved', { kind }), { duration: SAVED_TOAST_MS });
        } else {
          setStatus('idle');
        }
      },
      onError: (error) => {
        if (error instanceof RecipeForbiddenError) {
          setForbidden(true);
          setStatus('idle');
        } else {
          setStatus(error instanceof InvalidRecipeError ? 'rejected' : 'error');
        }
      },
    });
  };

  return (
    <>
      {!editable && (
        <div className="flex gap-3 rounded-[10px] border border-(--ssz-color-info-100) bg-(--ssz-color-info-50) px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-(--ssz-color-info-700)" aria-hidden />
          <div>
            <p className="font-semibold">{t('readonly.title')}</p>
            <p className="text-(--ssz-text-secondary)">{t('readonly.who')}</p>
          </div>
        </div>
      )}

      <RecipeCard
        title={t('card.title')}
        meta={savedAt ? t('card.metaSaved', { date: savedAt }) : t('card.metaNever')}
      >
        {saved.rules === null && rules.length === 0 && <NeverSetCallout kind={kind} />}

        <section className="flex flex-col gap-3">
          <SectionHeader title={t('presets.title')} />
          <RecipePresets
            selected={selected}
            edited={editable && selected !== null && matched === null}
            onPick={editable ? pickPreset : undefined}
          />
        </section>

        <hr className="-mx-4 border-(--ssz-border-default)" />

        <section className="flex flex-col gap-3">
          <SectionHeader
            title={t('rules.title')}
            aside={
              <span
                className={
                  rules.length >= MAX_RECIPE_RULES
                    ? 'font-semibold text-(--ssz-color-warning-700)'
                    : undefined
                }
              >
                {t('rules.count', { n: rules.length, max: MAX_RECIPE_RULES })}
              </span>
            }
          />
          {rules.length === 0 ? (
            <EmptyRules never={saved.rules === null} />
          ) : (
            <ol className="flex flex-col gap-3">
              {rules.map((rule, index) => (
                <RecipeRuleCard
                  key={rule.id}
                  rule={rule}
                  number={index + 1}
                  change={editable ? ruleChange(rule, saved.rules) : null}
                  onChange={
                    editable
                      ? (next) => edit(rules.map((r) => (r.id === next.id ? next : r)))
                      : undefined
                  }
                  onDelete={editable ? () => deleteRule(index) : undefined}
                />
              ))}
            </ol>
          )}

          {editable &&
            (rules.length >= MAX_RECIPE_RULES ? (
              <p
                role="status"
                className="rounded-[10px] border border-dashed border-(--ssz-border-strong) px-4 py-3 text-xs"
              >
                {t.rich('rules.limit', {
                  max: MAX_RECIPE_RULES,
                  b: (chunks) => <b>{chunks}</b>,
                })}
              </p>
            ) : (
              <button
                type="button"
                id={ADD_RULE_ID}
                onClick={addRule}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-(--ssz-border-strong) text-sm font-semibold text-(--ssz-text-secondary) hover:border-(--ssz-color-primary-300) hover:bg-(--ssz-color-primary-50) hover:text-(--ssz-color-primary-700) focus-visible:ring-[3px] focus-visible:ring-(--ssz-color-primary-500)/30 focus-visible:outline-none pointer-coarse:h-11"
              >
                <Plus className="size-4" aria-hidden />
                {t('rules.add')}
              </button>
            ))}
        </section>
      </RecipeCard>

      {editable ? (
        <RecipeActionBar
          kind={kind}
          status={status}
          dirty={dirty}
          neverSet={saved.rules === null}
          invalid={invalid}
          onDiscard={discard}
          onSave={submit}
        />
      ) : (
        <p className="text-xs text-(--ssz-text-muted)">
          {savedAt ? t('bar.readonly', { date: savedAt }) : t('bar.readonlyNever')}
        </p>
      )}
    </>
  );
}

export function RecipeCard({
  title,
  meta,
  sub,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[10px] border border-(--ssz-border-default) bg-(--ssz-bg-surface) p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {meta && <span className="text-xs text-(--ssz-text-muted)">{meta}</span>}
      </div>
      {sub && <p className="-mt-2 text-xs text-(--ssz-text-secondary)">{sub}</p>}
      {children}
    </section>
  );
}

function SectionHeader({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-[11px] font-bold tracking-[0.08em] text-(--ssz-text-secondary) uppercase">
        {title}
      </h3>
      {aside && <span className="text-xs text-(--ssz-text-muted) tabular-nums">{aside}</span>}
    </div>
  );
}

function NeverSetCallout({ kind }: { kind: RecipeWorkspaceKind }) {
  const t = useTranslations('Settings.recipe.never');
  return (
    <div className="flex gap-3 rounded-[10px] bg-(--ssz-bg-subtle) px-4 py-3 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-(--ssz-text-muted)" aria-hidden />
      <div>
        <p className="font-semibold">{t('title', { kind })}</p>
        <p className="text-(--ssz-text-secondary)">{t('body')}</p>
      </div>
    </div>
  );
}

function EmptyRules({ never }: { never: boolean }) {
  const t = useTranslations('Settings.recipe.rules');
  const key = never ? 'emptyNever' : 'empty';
  return (
    <div className="rounded-[10px] border border-dashed border-(--ssz-border-strong) bg-(--ssz-bg-subtle) p-5">
      <p className="text-sm font-semibold">{t(`${key}.title`)}</p>
      <p className="mt-1 text-xs text-(--ssz-text-secondary)">{t(`${key}.body`)}</p>
    </div>
  );
}

function RecipeSkeleton() {
  const t = useTranslations('Settings.recipe');
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <span className="sr-only" role="status">
        {t('loading')}
      </span>
      <div className="flex flex-col gap-4 rounded-[10px] border border-(--ssz-border-default) p-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-28" />
      <Skeleton className="h-14" />
    </div>
  );
}
