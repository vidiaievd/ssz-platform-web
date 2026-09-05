'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, Pencil, Copy, Archive, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { archiveGroup, deleteGroup, duplicateGroup } from '../api/mutations';
import type { GroupHealthRowVM } from '../types';

type Props = {
  schoolId: string;
  schoolSlug: string;
  group: Pick<GroupHealthRowVM, 'id' | 'name' | 'status' | 'studentCount'>;
};

type Dialog = 'archive' | 'delete' | null;

/**
 * Per-row ⋯ menu on the list (spec README §1 "row menu (⋯) + chevron").
 *
 * "Edit" opens the group itself — the list's row VM doesn't carry what
 * `GroupEditDialog` needs (teachers, slots, materials…), and the detail page is
 * where every one of those fields is already editable, so a second lightweight
 * edit form here would just be a worse copy of it.
 */
export function GroupRowMenu({ schoolId, schoolSlug, group }: Props) {
  const t = useTranslations('Groups');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);
  const detailHref = `/school/${schoolSlug}/groups/${group.id}`;

  const canDelete =
    (group.status === 'draft' || group.status === 'archived') && group.studentCount === 0;

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateGroup(schoolId, group.id);
      if (result.ok && result.id) {
        toast.success(t('detail.duplicated'));
        router.push(`/school/${schoolSlug}/groups/${result.id}`);
      } else {
        toast.error(t('detail.duplicateError'));
      }
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveGroup(schoolId, group.id);
      if (result.ok) {
        toast.success(t('detail.archived'));
        router.refresh();
      } else {
        toast.error(t('detail.archiveError'));
      }
      setDialog(null);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteGroup(schoolId, group.id);
      if (result.ok) {
        toast.success(t('detail.deleted'));
        router.refresh();
      } else {
        toast.error(t('detail.deleteError'));
      }
      setDialog(null);
    });
  }

  return (
    // Stops the click from reaching the row's own <Link> — the row navigates on
    // click everywhere else, and this menu has to be the one place that doesn't.
    <div onClick={(e) => e.stopPropagation()} className="contents">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('detail.moreActions')}
            // shrink-0: the row's menu cell is a flex row sharing width with
            // the chevron, and a flex item's explicit size is only a starting
            // point — without this it was the width, not the height, that
            // gave way when the cell ran tight, flattening a square button.
            className="size-7 shrink-0 text-(--ssz-text-muted)"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(detailHref)}>
            <Pencil className="size-3.5 mr-2" aria-hidden="true" />
            {t('detail.edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate} disabled={isPending}>
            <Copy className="size-3.5 mr-2" aria-hidden="true" />
            {t('detail.duplicate')}
          </DropdownMenuItem>
          {group.status !== 'archived' && (
            <DropdownMenuItem onClick={() => setDialog('archive')}>
              <Archive className="size-3.5 mr-2" aria-hidden="true" />
              {t('detail.archive')}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDialog('delete')}
                className="text-error-600 focus:text-error-600"
              >
                <Trash2 className="size-3.5 mr-2" aria-hidden="true" />
                {t('detail.delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={dialog === 'archive'} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('detail.archiveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('detail.archiveBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('edit.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleArchive} disabled={isPending}>
              {isPending ? t('detail.archiving') : t('detail.archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === 'delete'} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('detail.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('detail.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('edit.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleDelete} disabled={isPending}>
              {isPending ? t('detail.deleting') : t('detail.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
