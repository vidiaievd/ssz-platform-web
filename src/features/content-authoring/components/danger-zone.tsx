'use client';

import { useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import { toast } from 'sonner';
import { Trash2, Archive, RotateCcw, MinusCircle, UserCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

import type { ContainerState, SchoolRole } from '../types';

interface DangerZoneProps {
  containerId: string;
  containerTitle: string;
  state: ContainerState;
  role: SchoolRole;
}

function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  requireTypedTitle,
  expectedTitle,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  requireTypedTitle?: boolean;
  expectedTitle?: string;
}) {
  const [typed, setTyped] = useState('');
  const canConfirm = requireTypedTitle ? typed === expectedTitle : true;

  return (
    <AlertDialog onOpenChange={() => setTyped('')}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {requireTypedTitle && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Type <strong>{expectedTitle}</strong> to confirm:
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={expectedTitle}
              autoFocus
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!canConfirm}
            className={destructive ? 'bg-error text-white hover:bg-error/90' : ''}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DangerZone({ containerId, containerTitle, state, role }: DangerZoneProps) {
  const router = useRouter();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [, startTransition] = useTransition();

  const isOwner = role === 'owner';
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  const callLifecycle = async (endpoint: string, label: string) => {
    const res = await fetch(`/api/content/containers/${containerId}/${endpoint}`, {
      method: 'POST',
    });
    if (res.status === 501) {
      toast.info(`${label} — coming soon (pending backend support)`);
      return;
    }
    if (!res.ok) {
      toast.error(`Failed to ${label.toLowerCase()}`);
      return;
    }
    toast.success(`${label} successful`);
    startTransition(() => router.refresh());
  };

  const handleUnpublish = () => void callLifecycle('unpublish', 'Unpublish');
  const handleArchive   = () => void callLifecycle('archive', 'Archive');
  const handleRestore   = () => void callLifecycle('restore', 'Restore');

  const handleDelete = async () => {
    const res = await fetch(`/api/content/containers/${containerId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Failed to delete container');
      return;
    }
    toast.success('Container deleted');
    startTransition(() => router.push(`/school/${schoolSlug}/content`));
  };

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>

      <div className="space-y-2">
        {/* Draft actions */}
        {state === 'draft' && isOwnerOrAdmin && (
          <ConfirmAction
            trigger={
              <Button variant="danger" size="sm" className="w-full justify-start">
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Discard draft
              </Button>
            }
            title="Discard this draft?"
            description="The draft and all its content will be permanently deleted. This cannot be undone."
            confirmLabel="Discard"
            destructive
            onConfirm={handleDelete}
          />
        )}

        {/* Published actions */}
        {state === 'published' && isOwnerOrAdmin && (
          <>
            <ConfirmAction
              trigger={
                <Button variant="outline" size="sm" className="w-full justify-start text-warning-700 border-warning-300">
                  <MinusCircle className="mr-2 h-3.5 w-3.5" />
                  Unpublish
                </Button>
              }
              title="Unpublish this course?"
              description="Students will see a 'Course paused' banner. No new enrolments will be accepted. You can re-publish at any time."
              confirmLabel="Unpublish"
              onConfirm={handleUnpublish}
            />
            <ConfirmAction
              trigger={
                <Button variant="outline" size="sm" className="w-full justify-start text-warning-700 border-warning-300">
                  <Archive className="mr-2 h-3.5 w-3.5" />
                  Archive
                </Button>
              }
              title="Archive this course?"
              description="The course will be hidden from the catalogue. Enrolment will be closed. You can restore it later."
              confirmLabel="Archive"
              onConfirm={handleArchive}
            />
          </>
        )}

        {/* Archived actions */}
        {state === 'archived' && isOwnerOrAdmin && (
          <ConfirmAction
            trigger={
              <Button variant="outline" size="sm" className="w-full justify-start">
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Restore
              </Button>
            }
            title="Restore this course?"
            description="The course will be returned to its previous state (draft or published)."
            confirmLabel="Restore"
            onConfirm={handleRestore}
          />
        )}

        {/* Delete forever — owner only, any terminal state */}
        {isOwner && (
          <ConfirmAction
            trigger={
              <Button variant="danger" size="sm" className="w-full justify-start">
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete forever
              </Button>
            }
            title={`Delete "${containerTitle}"?`}
            description="All content, lessons, and student history for this course will be permanently deleted after 30 days."
            confirmLabel="Delete forever"
            destructive
            requireTypedTitle
            expectedTitle={containerTitle}
            onConfirm={handleDelete}
          />
        )}

        {/* Transfer ownership — owner only */}
        {isOwner && (
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" disabled>
            <UserCheck className="mr-2 h-3.5 w-3.5" />
            Transfer ownership
          </Button>
        )}
      </div>
    </div>
  );
}
