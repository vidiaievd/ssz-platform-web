'use client';

import { useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
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

import type { ContainerVersion, CurriculumTree } from '@/features/content/types';
import type { ContainerState, SchoolRole } from '../types';
import { authoringKeys } from '../api/keys';

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
  extraContent,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  requireTypedTitle,
  expectedTitle,
  typeToConfirmLabel,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  extraContent?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  requireTypedTitle?: boolean;
  expectedTitle?: string;
  typeToConfirmLabel?: string;
}) {
  const [typed, setTyped] = useState('');
  const canConfirm = requireTypedTitle
    ? typed.trim().toLowerCase() === expectedTitle?.trim().toLowerCase()
    : true;

  return (
    <AlertDialog onOpenChange={() => setTyped('')}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {extraContent}
        {requireTypedTitle && (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{typeToConfirmLabel}</p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={expectedTitle}
              autoFocus
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
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

function countTreeContent(tree: CurriculumTree): { modules: number; lessons: number } {
  let modules = 0;
  let lessons = 0;
  for (const level of tree.levels) {
    modules += level.modules.length;
    for (const mod of level.modules) {
      lessons += mod.ungroupedItems.length;
      for (const section of mod.sections) {
        lessons += section.items.length;
      }
    }
  }
  return { modules, lessons };
}

export function DangerZone({ containerId, containerTitle, state, role }: DangerZoneProps) {
  const t = useTranslations('Authoring.dangerZone');
  const router = useRouter();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [, startTransition] = useTransition();

  const isOwner = role === 'owner';
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  // Lazily counted so the delete confirmation can show "N modules / N lessons" per BEHAVIOR.md.
  const { data: contentCounts } = useQuery({
    queryKey: authoringKeys.contentCounts(containerId),
    queryFn: async () => {
      const versionsRes = await fetch(`/api/content/containers/${containerId}/versions`);
      if (!versionsRes.ok) return null;
      const versions = (await versionsRes.json()) as ContainerVersion[];
      const versionId = versions.find((v) => v.status === 'draft')?.id ?? versions[0]?.id;
      if (!versionId) return { modules: 0, lessons: 0 };
      const treeRes = await fetch(
        `/api/content/containers/${containerId}/versions/${versionId}/tree`,
      );
      if (!treeRes.ok) return null;
      const tree = (await treeRes.json()) as CurriculumTree;
      return countTreeContent(tree);
    },
    enabled: isOwner,
    staleTime: 30_000,
  });

  // Only relevant while the course is published (state === 'published' below gates the Archive action).
  const { data: enrollmentCount } = useQuery({
    queryKey: authoringKeys.enrollmentCount(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/enrollment-count`);
      if (!res.ok) return null;
      const data = (await res.json()) as { count: number };
      return data.count;
    },
    enabled: isOwnerOrAdmin && state === 'published',
    staleTime: 30_000,
  });

  const callLifecycle = async (
    endpoint: string,
    successMessage: string,
    errorMessage: string,
    toastOptions?: Parameters<typeof toast.success>[1],
  ) => {
    const res = await fetch(`/api/content/containers/${containerId}/${endpoint}`, {
      method: 'POST',
    });
    if (!res.ok) {
      toast.error(errorMessage);
      return;
    }
    toast.success(successMessage, toastOptions);
    startTransition(() => router.refresh());
  };

  const handleUnpublish = () =>
    void callLifecycle('unpublish', t('unpublish.success'), t('unpublish.error'));
  const handleRestore = () =>
    void callLifecycle('restore', t('restore.success'), t('restore.error'));
  const handleArchive = () =>
    void callLifecycle('archive', t('archive.success'), t('archive.error'), {
      action: { label: t('archive.undo'), onClick: handleRestore },
    });

  const handleDelete = async () => {
    const res = await fetch(`/api/content/containers/${containerId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error(t('deleteForever.error'));
      return;
    }
    toast.success(t('deleteForever.success'));
    startTransition(() => router.push(`/school/${schoolSlug}/content`));
  };

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-destructive">{t('heading')}</h3>

      <div className="space-y-2">
        {/* Draft actions */}
        {state === 'draft' && isOwnerOrAdmin && (
          <ConfirmAction
            trigger={
              <Button variant="danger" size="sm" className="w-full justify-start">
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                {t('discardDraft.trigger')}
              </Button>
            }
            title={t('discardDraft.title')}
            description={t('discardDraft.description')}
            confirmLabel={t('discardDraft.confirm')}
            cancelLabel={t('cancel')}
            destructive
            onConfirm={handleDelete}
          />
        )}

        {/* Published actions */}
        {state === 'published' && isOwnerOrAdmin && (
          <>
            <ConfirmAction
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-warning-700 border-warning-300"
                >
                  <MinusCircle className="mr-2 h-3.5 w-3.5" />
                  {t('unpublish.trigger')}
                </Button>
              }
              title={t('unpublish.title')}
              description={t('unpublish.description')}
              extraContent={
                enrollmentCount != null && enrollmentCount > 0 ? (
                  <p className="text-sm text-warning-700">
                    {t('unpublish.enrollmentWarning', { count: enrollmentCount })}
                  </p>
                ) : undefined
              }
              confirmLabel={t('unpublish.confirm')}
              cancelLabel={t('cancel')}
              onConfirm={handleUnpublish}
            />
            <ConfirmAction
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-warning-700 border-warning-300"
                >
                  <Archive className="mr-2 h-3.5 w-3.5" />
                  {t('archive.trigger')}
                </Button>
              }
              title={t('archive.title')}
              description={t('archive.description')}
              extraContent={
                enrollmentCount != null && enrollmentCount > 0 ? (
                  <p className="text-sm text-warning-700">
                    {t('archive.enrollmentWarning', { count: enrollmentCount })}
                  </p>
                ) : undefined
              }
              confirmLabel={t('archive.confirm')}
              cancelLabel={t('cancel')}
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
                {t('restore.trigger')}
              </Button>
            }
            title={t('restore.title')}
            description={t('restore.description')}
            confirmLabel={t('restore.confirm')}
            cancelLabel={t('cancel')}
            onConfirm={handleRestore}
          />
        )}

        {/* Delete forever — owner only, any terminal state */}
        {isOwner && (
          <ConfirmAction
            trigger={
              <Button variant="danger" size="sm" className="w-full justify-start">
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                {t('deleteForever.trigger')}
              </Button>
            }
            title={t('deleteForever.title', { title: containerTitle })}
            description={t('deleteForever.description')}
            extraContent={
              <div className="space-y-1 text-sm text-muted-foreground">
                {contentCounts && (
                  <p>
                    {t('deleteForever.contentCounts', {
                      modules: contentCounts.modules,
                      lessons: contentCounts.lessons,
                    })}
                  </p>
                )}
                <p>{t('deleteForever.steerToArchive')}</p>
              </div>
            }
            confirmLabel={t('deleteForever.confirm')}
            cancelLabel={t('cancel')}
            destructive
            requireTypedTitle
            expectedTitle={containerTitle}
            typeToConfirmLabel={t('deleteForever.typeToConfirm', { title: containerTitle })}
            onConfirm={handleDelete}
          />
        )}

        {/* Transfer ownership — owner only */}
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            disabled
          >
            <UserCheck className="mr-2 h-3.5 w-3.5" />
            {t('transferOwnership')}
          </Button>
        )}
      </div>
    </div>
  );
}
