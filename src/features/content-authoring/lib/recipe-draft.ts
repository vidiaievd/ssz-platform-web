import {
  FOCUSES,
  INPUTS,
  MODALITIES,
  OUTPUTS,
  RECIPE_PRESET_IDS,
  RECIPE_PRESETS,
  SKILLS,
  parseRule,
  readRecipe,
  type RecipeAxis,
  type RecipePresetId,
} from '@/lib/shared-kernel/skills';

import type { Recipe, RecipeRule } from '../types';

/**
 * A recipe rule as an editor holds it — plan 65, phase 0.
 *
 * The kernel's `RecipeRule` is what is stored and checked; this is what a person is in the
 * middle of typing. The two differ on purpose: the number stays a string, so that an empty
 * field and a zero are different mistakes; the ceiling is in whole percent, as the author
 * reads it; and every rule carries an id, so that "New" and "Edited" badges, Undo and the
 * focus after a delete follow the rule rather than its position.
 *
 * Shared by the workspace recipe page and the course settings drawer, so that both say
 * the same rule is broken for the same reason.
 */
export type DraftBound = 'min' | 'maxShare';

export interface DraftRule {
  id: string;
  axis: RecipeAxis;
  values: string[];
  negate: boolean;
  bound: DraftBound;
  n: string;
}

/**
 * The values a rule may name on each axis, in the order the kernel lists them. `unknown`
 * is left out of modality: it is the report admitting a gap, and a rule asking for more of
 * it would be asking for less judgement.
 */
export const RECIPE_VALUES: Readonly<Record<RecipeAxis, readonly string[]>> = {
  input: INPUTS,
  output: OUTPUTS,
  modality: MODALITIES.filter((m) => m !== 'unknown'),
  skill: SKILLS,
  focus: FOCUSES,
};

let sequence = 0;

/** A fresh client id. Ids only need to be unique within one page's life. */
export function nextDraftId(): string {
  sequence += 1;
  return `rule-${sequence}`;
}

// ── between the stored and the edited shape ─────────────────────────────────────

export function toDraft(rule: RecipeRule, id: string = nextDraftId()): DraftRule {
  return {
    id,
    axis: rule.axis,
    values: [...rule.values],
    negate: rule.negate === true,
    bound: rule.min !== undefined ? 'min' : 'maxShare',
    n: String(rule.min !== undefined ? rule.min : Math.round((rule.maxShare ?? 0) * 100)),
  };
}

export function toDrafts(recipe: Recipe): DraftRule[] {
  return recipe.rules.map((rule) => toDraft(rule));
}

function amountOf(n: string): number | null {
  const s = n.trim();
  return /^\d+$/.test(s) ? Number(s) : null;
}

/** The rule as the service would read it — values in the axis's order — or null. */
export function fromDraft(rule: DraftRule): RecipeRule | null {
  const amount = amountOf(rule.n);
  if (amount === null) return null;
  return parseRule({
    axis: rule.axis,
    values: RECIPE_VALUES[rule.axis].filter((v) => rule.values.includes(v)),
    ...(rule.negate ? { negate: true } : {}),
    ...(rule.bound === 'min' ? { min: amount } : { maxShare: amount / 100 }),
  });
}

/** The whole draft as a recipe to store, or null if any rule — or the count — is refused. */
export function toRecipe(rules: readonly DraftRule[]): Recipe | null {
  const parsed = rules.map(fromDraft);
  if (parsed.some((rule) => rule === null)) return null;
  return readRecipe({ rules: parsed });
}

// ── validation ───────────────────────────────────────────────────────────────────

export type RuleErrorKey = 'tickOne' | 'shareRange' | 'minOne';

export interface RuleError {
  field: 'values' | 'n';
  key: RuleErrorKey;
}

/**
 * What is wrong with a rule, field by field, for the message under it. The kernel's
 * `parseRule` stays the last word in `fromDraft`; this only says why in the author's terms.
 */
export function ruleErrors(rule: DraftRule): RuleError[] {
  const errors: RuleError[] = [];
  if (rule.values.length === 0) errors.push({ field: 'values', key: 'tickOne' });
  const amount = amountOf(rule.n);
  if (rule.bound === 'maxShare' && (amount === null || amount > 99))
    errors.push({ field: 'n', key: 'shareRange' });
  if (rule.bound === 'min' && (amount === null || amount < 1))
    errors.push({ field: 'n', key: 'minOne' });
  return errors;
}

/** One-based numbers of the rules that need a fix, for "Rules 2 and 4 need a fix". */
export function invalidRuleNumbers(rules: readonly DraftRule[]): number[] {
  return rules.flatMap((rule, i) => (ruleErrors(rule).length > 0 ? [i + 1] : []));
}

// ── edits, with the side effects the design asks for ────────────────────────────────

/** A value of one axis means nothing on another; the list starts empty again. */
export function setAxis(rule: DraftRule, axis: RecipeAxis): DraftRule {
  return { ...rule, axis, values: [] };
}

/** A count and a share have nothing in common, so the number starts over. */
export function setBound(rule: DraftRule, bound: DraftBound): DraftRule {
  return { ...rule, bound, n: bound === 'min' ? '1' : '50' };
}

export function toggleValue(rule: DraftRule, value: string): DraftRule {
  return {
    ...rule,
    values: rule.values.includes(value)
      ? rule.values.filter((v) => v !== value)
      : [...rule.values, value],
  };
}

/** An empty rule: invalid until a value is ticked, which is expected. */
export function newRule(axis: RecipeAxis = 'input', id: string = nextDraftId()): DraftRule {
  return { id, axis, values: [], negate: false, bound: 'min', n: '1' };
}

// ── comparing drafts ─────────────────────────────────────────────────────────────────

/** Order of values does not matter, order of rules does; `07` is `7`. */
function canonOne(rule: Omit<DraftRule, 'id'>): string {
  const amount = amountOf(rule.n);
  return JSON.stringify([
    rule.axis,
    [...rule.values].sort(),
    rule.negate,
    rule.bound,
    amount === null ? rule.n.trim() : String(amount),
  ]);
}

export function canon(rules: readonly Omit<DraftRule, 'id'>[]): string {
  return JSON.stringify(rules.map(canonOne));
}

/**
 * Whether there is anything to save. `saved = null` is a workspace that never set a
 * recipe: only rules make it dirty there. `[]` saved is a recipe of no rules, and
 * differs from never having one.
 */
export function isDirty(draft: readonly DraftRule[], saved: readonly DraftRule[] | null): boolean {
  return saved === null ? draft.length > 0 : canon(draft) !== canon(saved);
}

/** The kernel's preset as a fresh draft — new ids, so that Undo can tell them apart. */
export function presetDraft(id: RecipePresetId): DraftRule[] {
  return toDrafts(RECIPE_PRESETS[id] as Recipe);
}

/** The preset these rules are, exactly, or null. An empty draft is no preset. */
export function matchPreset(rules: readonly DraftRule[]): RecipePresetId | null {
  if (rules.length === 0) return null;
  const mine = canon(rules);
  return RECIPE_PRESET_IDS.find((id) => canon(presetDraft(id)) === mine) ?? null;
}

/** The badge on a rule against the last saved version. No badges before a first save. */
export function ruleChange(
  rule: DraftRule,
  saved: readonly DraftRule[] | null,
): 'new' | 'edited' | null {
  if (saved === null) return null;
  const before = saved.find((s) => s.id === rule.id);
  if (!before) return 'new';
  return canonOne(before) !== canonOne(rule) ? 'edited' : null;
}
