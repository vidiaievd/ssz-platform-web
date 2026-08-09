'use client';

import { useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/lib/i18n/navigation';

export interface NodeMenuProps {
  /** Names the group header, and decides which items apply. */
  kind: 'level' | 'module' | 'item';
  /** What the menu acts on — used for the trigger's accessible name. */
  nodeTitle: string;
  onRename?: () => void;
  /** Blocks only: the editor for the material this row points at. */
  editorHref?: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Blocks only: sections of the owning module, for "Move to…". */
  sections?: { id: string; title: string }[];
  currentSectionId?: string | null;
  onMoveToSection?: (sectionId: string | null) => void;
  className?: string;
}

/**
 * The ⋯ menu on every row.
 *
 * Items with no backend (duplicate, publishing a single block, moving a block
 * to another module) are listed where the design puts them but disabled and
 * marked, so the menu stays a truthful map of what this row can do — see
 * plan 38 §3.
 *
 * Keyboard hints are deliberately absent until the shortcuts themselves land
 * (phase H): a hint for a key that does nothing is the same broken promise as
 * a switch that does not save.
 */
export function NodeMenu({
  kind,
  nodeTitle,
  onRename,
  editorHref,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  sections,
  currentSectionId,
  onMoveToSection,
  className,
}: NodeMenuProps) {
  const t = useTranslations('Authoring');
  const tStub = useTranslations('Authoring.stub');

  /**
   * Closing a Radix menu returns focus to its trigger. Rename has to outlive
   * that: its input must mount *after* the menu is gone and keep the focus,
   * or it blurs the instant it appears and the edit ends before the author
   * types anything. So the item only records the intent, and the rename starts
   * from `onCloseAutoFocus`, which runs once closing is done.
   */
  const pendingRename = useRef(false);

  const groupLabel = t(`structure.${kind}` as 'structure.level');
  const notYet = <DropdownMenuShortcut>{tStub('short')}</DropdownMenuShortcut>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('structure.moreActions', { name: nodeTitle })}
        onClick={(e) => e.stopPropagation()}
        className={className}
      >
        <MoreHorizontal size={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-53"
        onClick={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => {
          if (!pendingRename.current) return;
          pendingRename.current = false;
          e.preventDefault();
          onRename?.();
        }}
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {groupLabel}
        </DropdownMenuLabel>

        <DropdownMenuItem
          disabled={!onRename}
          onSelect={() => {
            pendingRename.current = true;
          }}
        >
          {t('structure.rename')}
          {!onRename && notYet}
        </DropdownMenuItem>

        {kind === 'item' && editorHref && (
          <DropdownMenuItem asChild>
            <Link href={editorHref}>{t('structure.openLessonEditor')}</Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem disabled>
          {t('structure.duplicate')}
          {notYet}
        </DropdownMenuItem>

        <DropdownMenuItem disabled={!canMoveUp} onSelect={() => onMoveUp?.()}>
          {t('structure.moveUp')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canMoveDown} onSelect={() => onMoveDown?.()}>
          {t('structure.moveDown')}
        </DropdownMenuItem>

        {kind === 'item' && sections && onMoveToSection && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t('structure.moveTo')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                disabled={currentSectionId === null}
                onSelect={() => onMoveToSection(null)}
              >
                {t('sections.noSection')}
              </DropdownMenuItem>
              {sections.map((section) => (
                <DropdownMenuItem
                  key={section.id}
                  disabled={section.id === currentSectionId}
                  onSelect={() => onMoveToSection(section.id)}
                >
                  {section.title}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {/* Moving a block out of its module needs a cross-container move
                  the API does not have yet (plan 38 §3 B3). */}
              <DropdownMenuItem disabled>
                {t('structure.moveToAnotherModule')}
                {notYet}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          {t('structure.unpublish')}
          {notYet}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
