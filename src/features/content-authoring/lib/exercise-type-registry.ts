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
  input: 'text' | 'audio' | 'video' | 'image' | 'none';
  output: 'none' | 'written_target' | 'written_l1' | 'spoken';
  retrieval: 'select' | 'recombine' | 'recall' | 'produce' | 'monitor';
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
 * Every exercise type the editor knows of: the thirteen the catalogue can
 * create, and the eight the catalogue has written down.
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

  // ── Catalogue, not yet built (spec 19 §3) ──────────────────────────────────
  sort_into_buckets: {
    code: 'sort_into_buckets',
    labelKey: 'sort_into_buckets',
    section: 'exercise',
    icon: Columns3,
    status: 'planned',
    axes: { input: 'text', output: 'none', retrieval: 'recombine' },
  },
  highlight_in_text: {
    code: 'highlight_in_text',
    labelKey: 'highlight_in_text',
    section: 'exercise',
    icon: Highlighter,
    status: 'planned',
    axes: { input: 'text', output: 'none', retrieval: 'select' },
  },
  dictation: {
    code: 'dictation',
    labelKey: 'dictation',
    section: 'exercise',
    icon: Mic,
    status: 'planned',
    axes: { input: 'audio', output: 'written_target', retrieval: 'recall' },
  },
  inflection_table: {
    code: 'inflection_table',
    labelKey: 'inflection_table',
    section: 'grammar',
    icon: Table,
    status: 'planned',
    axes: { input: 'text', output: 'written_target', retrieval: 'recall' },
  },
  read_aloud: {
    code: 'read_aloud',
    labelKey: 'read_aloud',
    section: 'exercise',
    icon: Speech,
    status: 'planned',
    axes: { input: 'text', output: 'spoken', retrieval: 'produce' },
  },
  speaking_prompt: {
    code: 'speaking_prompt',
    labelKey: 'speaking_prompt',
    section: 'exercise',
    icon: Mic,
    status: 'planned',
    axes: { input: 'text', output: 'spoken', retrieval: 'produce' },
  },
  minimal_pairs: {
    code: 'minimal_pairs',
    labelKey: 'minimal_pairs',
    section: 'exercise',
    icon: Ear,
    status: 'planned',
    axes: { input: 'audio', output: 'none', retrieval: 'select' },
  },
  information_transfer: {
    code: 'information_transfer',
    labelKey: 'information_transfer',
    section: 'exercise',
    icon: ClipboardList,
    status: 'planned',
    axes: { input: 'text', output: 'written_target', retrieval: 'recall' },
  },
};

/** `undefined` for a code no catalogue knows — a newer server, or a typo. */
export function exerciseType(code: string | null | undefined): ExerciseTypeDefinition | undefined {
  return code ? EXERCISE_TYPES[code] : undefined;
}

/** The codes an author may actually create, in catalogue order. */
export function liveExerciseTypes(): ExerciseTypeDefinition[] {
  return Object.values(EXERCISE_TYPES).filter((t) => t.status === 'live');
}
