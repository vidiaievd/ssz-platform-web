'use client';

import { useTransition, useState } from 'react';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { reorderContainerItemsAction } from '../actions/container-item';
import type { ModuleItemData } from './module-row';
import { ModuleRow } from './module-row';
import { ReorderWithAnnouncer } from './lesson-reorder';

/* ── Loading skeleton ────────────────────────────────────── */
function ModuleListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
      ))}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────── */
function ModuleListEmpty({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations('Authoring.moduleBuilder');
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      <p className="text-[17px] font-bold" style={{ color: 'var(--ssz-text-primary)' }}>
        {t('emptyTitle')}
      </p>
      <p className="max-w-xs text-sm" style={{ color: 'var(--ssz-text-secondary)' }}>
        {t('emptyBody')}
      </p>
      <Button variant="outline" onClick={onAdd} className="mt-2">
        <Plus size={15} aria-hidden />
        {t('addModule')}
      </Button>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────── */
export interface ModuleListProps {
  /** ID of the parent course container. */
  courseId: string;
  items: ModuleItemData[];
  isLoading?: boolean;
  onAdd: () => void;
  onOpen: (item: ModuleItemData) => void;
  onPreview: (item: ModuleItemData) => void;
  onRename: (item: ModuleItemData) => void;
  onDuplicate: (item: ModuleItemData) => void;
  onTogglePublish: (item: ModuleItemData) => void;
  /** Called after the list has been optimistically reordered so the parent can persist. */
  onReorder: (reordered: ModuleItemData[]) => void;
  onDelete: (item: ModuleItemData) => void;
}

export function ModuleList({
  courseId,
  items,
  isLoading = false,
  onAdd,
  onOpen,
  onPreview,
  onRename,
  onDuplicate,
  onTogglePublish,
  onReorder,
  onDelete,
}: ModuleListProps) {
  const t = useTranslations('Authoring.moduleBuilder');
  const [localItems, setLocalItems] = useState<ModuleItemData[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ModuleItemData | null>(null);
  const [isPending, startTransition] = useTransition();

  const displayed = localItems ?? items;

  function handleReorder(reordered: ModuleItemData[]) {
    setLocalItems(reordered);
    startTransition(async () => {
      try {
        const result = await reorderContainerItemsAction(courseId, reordered.map(i => i.id));
        if (!result.ok) throw new Error(result.error.code);
        onReorder(reordered);
      } catch {
        toast.error('Failed to save new order. Please try again.');
        setLocalItems(null);
      }
    });
  }

  function handleMoveToTop(item: ModuleItemData) {
    const reordered = [item, ...displayed.filter(i => i.id !== item.id)];
    handleReorder(reordered);
  }

  function handleMoveToBottom(item: ModuleItemData) {
    const reordered = [...displayed.filter(i => i.id !== item.id), item];
    handleReorder(reordered);
  }

  function confirmDelete(item: ModuleItemData) {
    setPendingDelete(item);
  }

  function executeDelete() {
    if (!pendingDelete) return;
    onDelete(pendingDelete);
    setPendingDelete(null);
  }

  if (isLoading) return <ModuleListSkeleton />;

  return (
    <>
      {/* Section head */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ssz-text-primary)' }}>
            {t('sectionHead')}
            <span
              className="ml-2 text-[13px] font-normal"
              style={{ color: 'var(--ssz-text-muted)' }}
            >
              {displayed.length} · {t('sectionSubhead')}
            </span>
          </h2>
        </div>
        <span className="text-[12px]" style={{ color: 'var(--ssz-text-muted)' }}>
          {t('dragHint')}
        </span>
      </div>

      {displayed.length === 0 ? (
        <ModuleListEmpty onAdd={onAdd} />
      ) : (
        <>
          <ReorderWithAnnouncer
            items={displayed}
            onReorder={reordered => handleReorder(reordered as ModuleItemData[])}
          >
            {(item, position) => (
              <ModuleRow
                item={item as ModuleItemData}
                position={position}
                onOpen={onOpen}
                onPreview={onPreview}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onTogglePublish={onTogglePublish}
                onMoveToTop={handleMoveToTop}
                onMoveToBottom={handleMoveToBottom}
                onDelete={confirmDelete}
              />
            )}
          </ReorderWithAnnouncer>

          {/* Add module button */}
          <Button
            variant="outline"
            className="mt-3 w-full border-dashed"
            onClick={onAdd}
            disabled={isPending}
          >
            <Plus size={15} aria-hidden />
            {t('addModule')}
          </Button>
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={open => { if (!open) setPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('deleteConfirmTitle', { title: pendingDelete?.title ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmBody', {
                title: pendingDelete?.title ?? '',
                count: pendingDelete?.readiness?.lessonCount ?? 0,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('deleteConfirmCta')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
