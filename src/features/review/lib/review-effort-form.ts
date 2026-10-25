import type {
  ReviewEffortMeasurement,
  SchoolReviewEffort,
  SchoolReviewEffortInput,
} from '../types/oversight';

/** The bounds organization-service enforces on a figure, mirrored for an early answer. */
export const MIN_EFFORT_MINUTES = 1;
export const MAX_EFFORT_MINUTES = 120;

/** One template as the form lists it. */
export interface EffortRow {
  templateCode: string;
  /**
   * Where the starting figure comes from now: the school, the factory, or — for a template
   * only the measurements know — the figure for "other types".
   */
  source: 'school' | 'default' | 'other';
  /** What an empty field stands for; null where it is not known (a factory figure the school replaced). */
  placeholder: number | null;
  measured: ReviewEffortMeasurement | null;
}

/** What is typed: a figure per template, `''` for "the factory's". */
export interface EffortDraft {
  templates: Record<string, string>;
  other: string;
}

/**
 * The school's templates and every one it has measurements on, in code order.
 *
 * A template with verdicts timed but no figure of its own follows "other types"; it is
 * listed all the same, so the school can give it one.
 */
export function effortRows(data: SchoolReviewEffort): EffortRow[] {
  const measured = new Map(
    (data.measured?.templates ?? []).map((entry) => [entry.templateCode, entry]),
  );
  const known = new Map(data.templates.map((entry) => [entry.templateCode, entry]));
  const codes = [...new Set([...known.keys(), ...measured.keys()])].sort();

  return codes.map((templateCode) => {
    const entry = known.get(templateCode);
    return {
      templateCode,
      source: entry?.source ?? 'other',
      placeholder:
        entry === undefined
          ? data.other.minutes
          : entry.source === 'default'
            ? entry.minutes
            : null,
      measured: measured.get(templateCode) ?? null,
    };
  });
}

/** The server's figures as the form starts from them: only the school's own are typed in. */
export function effortDraft(data: SchoolReviewEffort): EffortDraft {
  return {
    templates: Object.fromEntries(
      data.templates
        .filter((entry) => entry.source === 'school')
        .map((entry) => [entry.templateCode, String(entry.minutes)]),
    ),
    other: data.other.source === 'school' ? String(data.other.minutes) : '',
  };
}

/** A field is fine empty (the factory's) or holding a whole number in bounds. */
export function isEffortValue(value: string): boolean {
  if (value.trim() === '') return true;
  const minutes = Number(value);
  return (
    Number.isInteger(minutes) && minutes >= MIN_EFFORT_MINUTES && minutes <= MAX_EFFORT_MINUTES
  );
}

/** The write, whole: an empty field is left out and goes back to the factory figure. */
export function effortInput(draft: EffortDraft): SchoolReviewEffortInput {
  return {
    templates: Object.fromEntries(
      Object.entries(draft.templates)
        .filter(([, value]) => value.trim() !== '')
        .map(([code, value]) => [code, Number(value)]),
    ),
    other: draft.other.trim() === '' ? null : Number(draft.other),
  };
}
