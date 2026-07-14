import { BookOpen, Calendar, Headphones, Layers, Pen, Play, Target, type LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * The 7 authorable material kinds (design handoff `CM_TYPES`, see
 * design_handoff_course_management/coursemgmt/ui.jsx). Backend representation:
 * `vocab`/`grammar`/`exercise` map 1:1 to ContainerItem.itemType
 * (`vocabulary_list`/`grammar_rule`/`exercise`); `text`/`video`/`audio`/`live`
 * are itemType `lesson` distinguished by `Lesson.kind` (plan 29 §0).
 */
export type MaterialKind = 'vocab' | 'text' | 'video' | 'audio' | 'grammar' | 'exercise' | 'live';

export const MATERIAL_KINDS: readonly MaterialKind[] = [
  'vocab',
  'text',
  'video',
  'audio',
  'grammar',
  'exercise',
  'live',
];

export interface LessonTypeDefinition {
  kind: MaterialKind;
  icon: LucideIcon;
  /** CSS custom property (src/styles/globals.css) carrying this type's hue. */
  hueVar: string;
  /** next-intl key, `Authoring` namespace; JSON entries land in FE0.3. */
  labelKey: string;
  /** Editor shown from the add-lesson picker (FE1.4) and edit route; wired per-type in FE2.*. */
  editorComponent?: ComponentType;
  /** Reader page rendered inside ReaderShell (FE4.1); wired per-type in FE5.*. */
  readerComponent?: ComponentType;
}

export const LESSON_TYPE_REGISTRY: Readonly<Record<MaterialKind, LessonTypeDefinition>> = {
  vocab: {
    kind: 'vocab',
    icon: Layers,
    hueVar: '--ssz-type-vocab',
    labelKey: 'materialType.vocab',
  },
  text: {
    kind: 'text',
    icon: BookOpen,
    hueVar: '--ssz-type-text',
    labelKey: 'materialType.text',
  },
  video: {
    kind: 'video',
    icon: Play,
    hueVar: '--ssz-type-video',
    labelKey: 'materialType.video',
  },
  audio: {
    kind: 'audio',
    icon: Headphones,
    hueVar: '--ssz-type-audio',
    labelKey: 'materialType.audio',
  },
  grammar: {
    kind: 'grammar',
    icon: Pen,
    hueVar: '--ssz-type-grammar',
    labelKey: 'materialType.grammar',
  },
  exercise: {
    kind: 'exercise',
    icon: Target,
    hueVar: '--ssz-type-exercise',
    labelKey: 'materialType.exercise',
  },
  live: {
    kind: 'live',
    icon: Calendar,
    hueVar: '--ssz-type-live',
    labelKey: 'materialType.live',
  },
};

export function getLessonTypeDefinition(kind: MaterialKind): LessonTypeDefinition {
  return LESSON_TYPE_REGISTRY[kind];
}
