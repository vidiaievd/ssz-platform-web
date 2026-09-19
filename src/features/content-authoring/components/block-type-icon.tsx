'use client';

import { useTranslations } from 'next-intl';

import { getLessonTypeDefinition, type MaterialKind } from '@/lib/content/lesson-types';
import { cn } from '@/lib/utils';

import { exerciseType } from '../lib/exercise-type-registry';

interface BlockTypeIconProps {
  /** Which kind of material the row holds — this is what the tile's colour says. */
  kind: MaterialKind;
  /** For exercises, which template it uses; this is what the glyph says. */
  templateCode?: string | null;
  /** Glyph size in px. 15 in the tree, 13 in the add-block menu (ICONS.md). */
  size?: number;
  /** Tile size class. Defaults to the 22px tile the tree and the menu both use. */
  className?: string;
}

/**
 * The tile in front of a block row: colour by section, picture by type.
 *
 * Until now every exercise in a course wore the same target, so a section of
 * twelve exercises was twelve identical rows and the only way to tell a
 * gap-fill from a translation was to read the label. The pairing of a type with
 * its picture is what makes the list scannable, and it is the pairing rather
 * than any particular drawing that does the work (ICONS.md).
 *
 * A template the registry does not know — a newer server, a type added since
 * this build — falls back to the generic exercise glyph. Never an empty tile.
 */
export function BlockTypeIcon({ kind, templateCode, size = 15, className }: BlockTypeIconProps) {
  const t = useTranslations();
  const def = getLessonTypeDefinition(kind);
  const type = kind === 'exercise' ? exerciseType(templateCode) : undefined;
  const Icon = type?.icon ?? def.icon;

  const label = type
    ? t(`Authoring.exercises.types.${type.labelKey}` as 'Authoring.exercises.types.match_pairs')
    : t(`Content.materialType.${kind}` as 'Content.materialType.text');

  return (
    <span
      // Decorative: the row says in words what this is, and a screen reader
      // reading the type twice is worse than not drawing it at all.
      aria-hidden
      title={label}
      className={cn('flex size-5.5 shrink-0 items-center justify-center rounded-xs', className)}
      style={{ background: `color-mix(in oklch, var(${def.hueVar}) 16%, transparent)` }}
    >
      <Icon size={size} style={{ color: `var(${def.hueVar})` }} />
    </span>
  );
}
