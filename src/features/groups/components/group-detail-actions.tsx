'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, Pencil, Copy, Archive, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GroupEditSheet } from './group-edit-sheet';
import { archiveGroup, deleteGroup, duplicateGroup } from '../api/mutations';
import type { Group } from '../types';

type Props = {
  group: Group;
  schoolSlug: string;
  canManage: boolean;
};

type Dialog = 'archive' | 'delete' | null;

export function GroupDetailActions({ group, schoolSlug, canManage }: Props) {
  // Gating on canManage lands in a later step; accepted here so callers can thread it through now.
  void canManage;
  const t = useTranslations('Groups');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  // schoolSlug is used as schoolId here; the BFF resolves slug→id.
  const schoolId = schoolSlug;
  const listHref = `/school/${schoolSlug}/groups`;

  const canDelete =
    (group.status === 'draft' || group.status === 'archived') && group.studentCount === 0;

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateGroup(schoolId, group.id);
      if (result.ok && result.id) {
        toast.success(t('detail.duplicated'));
        router.push(`/school/${schoolSlug}/groups/${result.id}`);
      } else {
        toast.error('Failed to duplicate group');
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
        toast.error('Failed to archive group');
      }
      setDialog(null);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteGroup(schoolId, group.id);
      if (result.ok) {
        toast.success(t('detail.deleted'));
        router.push(listHref);
      } else {
        toast.error('Failed to delete group');
      }
      setDialog(null);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="size-3.5 mr-1.5" aria-hidden="true" />
          {t('detail.edit')}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
      </div>

      {/* Edit sheet */}
      <GroupEditSheet
        group={group}
        schoolId={schoolId}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {/* Archive confirm */}
      <AlertDialog open={dialog === 'archive'} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('detail.archiveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('detail.archiveBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={handleArchive}
              disabled={isPending}
            >
              {isPending ? t('detail.archiving') : t('detail.archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={dialog === 'delete'} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('detail.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('detail.deleteBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('edit.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? t('detail.deleting') : t('detail.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
