'use client';

import { Eye, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ContainerItem } from '@/features/content/types';

import { ContainerStateBadge } from './container-state-badge';
import type { ModuleReadiness } from './readiness-chip';
import { moduleReadinessChips, ReadinessChip } from './readiness-chip';

export interface ModuleItemData extends ContainerItem {
  /** Published state of the module container itself. */
  moduleState?: 'draft' | 'published' | 'archived';
  /** Can-do statement (first-person goal of the module). */
  canDoStatement?: string | null;
  readiness?: ModuleReadiness;
}

export interface ModuleRowProps {
  item: ModuleItemData;
  position: number;
  onOpen: (item: ModuleItemData) => void;
  onPreview: (item: ModuleItemData) => void;
  onRename: (item: ModuleItemData) => void;
  onDuplicate: (item: ModuleItemData) => void;
  onTogglePublish: (item: ModuleItemData) => void;
  onMoveToTop: (item: ModuleItemData) => void;
  onMoveToBottom: (item: ModuleItemData) => void;
  onDelete: (item: ModuleItemData) => void;
}

export function ModuleRow({
  item,
  position,
  onOpen,
  onPreview,
  onRename,
  onDuplicate,
  onTogglePublish,
  onMoveToTop,
  onMoveToBottom,
  onDelete,
}: ModuleRowProps) {
  const t = useTranslations('Authoring.moduleBuilder');
  const chips = item.readiness ? moduleReadinessChips(item.readiness) : [];
  const moduleState = item.moduleState ?? 'draft';
  const isPublished = moduleState === 'published';

  return (
    /* Row body — clicking anywhere (except handle/actions) opens the module */
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group flex w-full items-start gap-3 rounded-xl border border-border bg-[var(--ssz-bg-surface)] px-4 py-3.5 text-left shadow-[var(--ssz-shadow-xs)] transition-shadow duration-160 hover:shadow-[var(--ssz-shadow-md)]"
    >
      {/* Position number */}
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums"
        style={{
          background: 'var(--ssz-bg-subtle)',
          color: 'var(--ssz-text-muted)',
        }}
        aria-hidden
      >
        {position}
      </span>

      {/* Body */}
      <span className="min-w-0 flex-1">
        {/* Title row */}
        <span className="mb-1 flex flex-wrap items-center gap-2">
          <span
            className="text-[14.5px] font-semibold truncate"
            style={{ color: 'var(--ssz-text-primary)' }}
          >
            {item.title ?? t('untitled')}
          </span>
          <ContainerStateBadge state={moduleState} />
        </span>

        {/* Can-do statement */}
        {item.canDoStatement && (
          <span
            className="mb-2 block text-[12.5px] leading-snug"
            style={{ color: 'var(--ssz-text-secondary)' }}
          >
            {item.canDoStatement}
          </span>
        )}

        {/* Readiness chips */}
        {chips.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <ReadinessChip
                key={chip.label}
                tone={chip.tone}
                label={chip.tone === 'warn' ? `${chip.label}` : chip.label}
                aria-label={chip.tone === 'warn' ? `Warning: ${chip.label}` : chip.label}
              />
            ))}
          </span>
        )}
      </span>

      {/* Action buttons — stop propagation so they don't trigger onOpen */}
      <span className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={t('previewAriaLabel', { title: item.title ?? '' })}
          onClick={(e) => { e.stopPropagation(); onPreview(item); }}
        >
          <Eye size={16} aria-hidden />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={t('moreAriaLabel', { title: item.title ?? '' })}
            >
              <MoreHorizontal size={16} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRename(item)}>
              {t('menuRename')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(item)}>
              {t('menuDuplicate')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTogglePublish(item)}>
              {isPublished ? t('menuUnpublish') : t('menuPublish')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onMoveToTop(item)}>
              {t('menuMoveTop')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveToBottom(item)}>
              {t('menuMoveBottom')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(item)}
              className="text-destructive focus:text-destructive"
            >
              {t('menuDelete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </button>
  );
}
