'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
};

type Dialog = 'archive' | 'delete' | null;

export function GroupDetailActions({ group, schoolSlug }: Props) {
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
        toast.success('Group duplicated as draft');
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
        toast.success('Group archived');
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
        toast.success('Group deleted');
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
          Edit
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
              Duplicate
            </DropdownMenuItem>
            {group.status !== 'archived' && (
              <DropdownMenuItem onClick={() => setDialog('archive')}>
                <Archive className="size-3.5 mr-2" aria-hidden="true" />
                Archive
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
                  Delete
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
            <AlertDialogTitle>Archive this group?</AlertDialogTitle>
            <AlertDialogDescription>
              Archiving will make the group read-only. You can unarchive it later by contacting support.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={handleArchive}
              disabled={isPending}
            >
              {isPending ? 'Archiving…' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={dialog === 'delete'} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this group?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone. The group and all its data will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
