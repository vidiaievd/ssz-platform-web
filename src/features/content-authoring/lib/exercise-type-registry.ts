import {
  ArrowRightLeft,
  Blocks,
  CircleDot,
  ClipboardList,
  Columns3,
  Ear,
  Highlighter,
  Languages,
  Link2,
  ListChecks,
  ListOrdered,
  Mic,
  NotebookPen,
  PenLine,
  PencilLine,
  Speech,
  SpellCheck,
  SquareDashed,
  Table,
  Tags,
  type LucideIcon,
} from 'lucide-react';

import type { MaterialKind } from '@/lib/content/lesson-types';
import type { Focus, Input, Modality, Output } from '@/lib/shared-kernel/skills';

/**
 * Whether the type can be created today. `planned` rows are catalogue entries
 * from `docs/plan/spec/19_new_exercise_types.md` — a type with no template in
 * the seed and no validator in the engine is not authorable, and listing it
 * here does not make it so (spec 19 §3). They are here for the two readers that
 * need to know a type exists before it does: the pictograms, so a row arriving
 * from a newer server is never a blank tile, and the lesson coverage recipe.
 */
export type ExerciseTypeStatus = 'live' | 'planned';

/**
 * What a not-yet-built type would train, as the catalogue claims it.
 *
 * Only `planned` rows carry this. A live type's axes are derived by the kernel
 * from its document (`lib/shared-kernel/skills`), and restating them here would
 * be a second scale to keep in step with the first — the whole failure the
 * coverage report exists to avoid.
 */
export interface PlannedAxes {
  input: Input;
  output: Output;
  /**
   * How the answer has to be known — the axis the lesson recipe speaks. Spec 19 wrote
   * these rows with a five-value `retrieval`; decision G of plan 64 gave that role to
   * `modality`, and a recipe could not advise a type described in a scale it does not read.
   */
  modality: Modality;
  /** Only where the type is structurally about one subject — rule 2 of `by-template.ts`. */
  focus?: readonly Focus[];
}

export interface ExerciseTypeDefinition {
  code: string;
  /** `Authoring.exercises.types.<code>`. */
  labelKey: string;
  /** Which section of a module the type belongs in, and so which hue its tile takes. */
  section: Extract<MaterialKind, 'vocab' | 'text' | 'audio' | 'grammar' | 'exercise'>;
  icon: LucideIcon;
  status: ExerciseTypeStatus;
  axes?: PlannedAxes;
}

/**
 * Every exercise type the editor knows of: the ones the kernel judges, and
 * the ones the catalogue has only written down.
 *
 * One glyph per type, and the pairing is the point — recognition is built on a
 * type and its picture staying together, not on any particular picture
 * (ICONS.md). The tile's colour carries the section, never the type.
 */
export const EXERCISE_TYPES: Readonly<Record<string, ExerciseTypeDefinition>> = {
  multiple_choice: {
    code: 'multiple_choice',
    labelKey: 'multiple_choice',
    section: 'exercise',
    icon: CircleDot,
    status: 'live',
  },
  multiple_choice_group: {
    code: 'multiple_choice_group',
    labelKey: 'multiple_choice_group',
    section: 'exercise',
    icon: ListChecks,
    status: 'live',
  },
  // Retired in favour of `word_bank_gap_fill`, and still under a hundred
  // exercises: a row drawn as a hole would be worse than one drawn as itself.
  fill_in_blank: {
    code: 'fill_in_blank',
    labelKey: 'fill_in_blank',
    section: 'exercise',
    icon: PenLine,
    status: 'live',
  },
  word_bank_fill: {
    code: 'word_bank_fill',
    labelKey: 'word_bank_fill',
    section: 'exercise',
    icon: Tags,
    status: 'live',
  },
  word_bank_gap_fill: {
    code: 'word_bank_gap_fill',
    labelKey: 'word_bank_gap_fill',
    section: 'exercise',
    icon: SquareDashed,
    status: 'live',
  },
  text_order: {
    code: 'text_order',
    labelKey: 'text_order',
    section: 'exercise',
    icon: ListOrdered,
    status: 'live',
  },
  error_correction: {
    code: 'error_correction',
    labelKey: 'error_correction',
    section: 'exercise',
    icon: SpellCheck,
    status: 'live',
  },
  translate_to_target: {
    code: 'translate_to_target',
    labelKey: 'translate_to_target',
    section: 'exercise',
    icon: Languages,
    status: 'live',
  },
  translate_from_target: {
    code: 'translate_from_target',
    labelKey: 'translate_from_target',
    section: 'exercise',
    icon: ArrowRightLeft,
    status: 'live',
  },
  match_pairs: {
    code: 'match_pairs',
    labelKey: 'match_pairs',
    section: 'exercise',
    icon: Link2,
    status: 'live',
  },
  short_answer: {
    code: 'short_answer',
    labelKey: 'short_answer',
    section: 'exercise',
    icon: PencilLine,
    status: 'live',
  },
  writing_task: {
    code: 'writing_task',
    labelKey: 'writing_task',
    section: 'exercise',
    icon: NotebookPen,
    status: 'live',
  },
  sentence_schema: {
    code: 'sentence_schema',
    labelKey: 'sentence_schema',
    section: 'exercise',
    icon: Blocks,
    status: 'live',
  },
  // Plan 66. Live from the moment the kernel judges it (`by-template.ts`), which is what
  // this status means to the recipe; the add-block menu is `CREATABLE_EXERCISE_TYPES`.
  sort_into_buckets: {
    code: 'sort_into_buckets',
    labelKey: 'sort_into_buckets',
    section: 'exercise',
    icon: Columns3,
    status: 'live',
  },

  // ── Catalogue, not yet built (spec 19 §3) ──────────────────────────────────
  highlight_in_text: {
    code: 'highlight_in_text',
    labelKey: 'highlight_in_text',
    section: 'exercise',
    icon: Highlighter,
    status: 'planned',
    axes: { input: 'text', output: 'none', modality: 'recognition' },
  },
  dictation: {
    code: 'dictation',
    labelKey: 'dictation',
    section: 'exercise',
    icon: Mic,
    status: 'planned',
    axes: { input: 'audio', output: 'written_target', modality: 'recall' },
  },
  inflection_table: {
    code: 'inflection_table',
    labelKey: 'inflection_table',
    section: 'grammar',
    icon: Table,
    status: 'planned',
    axes: { input: 'text', output: 'written_target', modality: 'recall', focus: ['grammar'] },
  },
  read_aloud: {
    code: 'read_aloud',
    labelKey: 'read_aloud',
    section: 'exercise',
    icon: Speech,
    status: 'planned',
    // The words are on screen: what is retrieved is how they sound, not what to say.
    axes: { input: 'text', output: 'spoken', modality: 'recall' },
  },
  speaking_prompt: {
    code: 'speaking_prompt',
    labelKey: 'speaking_prompt',
    section: 'exercise',
    icon: Mic,
    status: 'planned',
    axes: { input: 'text', output: 'spoken', modality: 'production' },
  },
  minimal_pairs: {
    code: 'minimal_pairs',
    labelKey: 'minimal_pairs',
    section: 'exercise',
    icon: Ear,
    status: 'planned',
    axes: { input: 'audio', output: 'none', modality: 'recognition' },
  },
  information_transfer: {
    code: 'information_transfer',
    labelKey: 'information_transfer',
    section: 'exercise',
    icon: ClipboardList,
    status: 'planned',
    axes: { input: 'text', output: 'written_target', modality: 'recall' },
  },
};

/** `undefined` for a code no catalogue knows — a newer server, or a typo. */
export function exerciseType(code: string | null | undefined): ExerciseTypeDefinition | undefined {
  return code ? EXERCISE_TYPES[code] : undefined;
}

/**
 * Live, and still opened by the general form, but absorbed by `word_bank_gap_fill`
 * (plan 35): nothing should advise an author to make a new one.
 */
export const RETIRED_EXERCISE_TYPES: ReadonlySet<string> = new Set([
  'fill_in_blank',
  'word_bank_fill',
]);

/** The codes an author may actually create, in catalogue order. */
export function liveExerciseTypes(): ExerciseTypeDefinition[] {
  return Object.values(EXERCISE_TYPES).filter((t) => t.status === 'live');
}
