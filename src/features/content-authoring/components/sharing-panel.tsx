'use client';

import { useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trash2, UserPlus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { ContainerShare, ShareRole } from '@/features/content/types';

import { useEntityShares } from '../api/use-authoring-shares';
import { authoringKeys } from '../api/keys';
import { addShareAction, removeShareAction } from '../actions/share';

interface SharingPanelProps {
  entityType: string;
  entityId: string;
}

const SHARE_ROLES: ShareRole[] = ['viewer', 'co_author'];

export function SharingPanel({ entityType, entityId }: SharingPanelProps) {
  const t = useTranslations('Authoring');
  const tErrors = useTranslations('Errors');
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [pendingRemove, setPendingRemove] = useState<ContainerShare | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('viewer');

  const { data: shares, isLoading, isError } = useEntityShares(entityType, entityId);

  function handleAdd() {
    const trimmed = email.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await addShareAction(entityType, entityId, trimmed, role);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.shares(entityType, entityId),
      });
      setEmail('');
      toast.success(t('sharing.addSuccess'));
    });
  }

  function confirmRemove() {
    if (!pendingRemove) return;
    const target = pendingRemove;
    setPendingRemove(null);
    startTransition(async () => {
      const result = await removeShareAction(target.id, entityType, entityId);
      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: authoringKeys.shares(entityType, entityId),
      });
      toast.success(t('sharing.removeSuccess'));
    });
  }

  return (
    <div className="space-y-6">
      {/* Current collaborators */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t('sharing.collaborators')}</h3>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-muted-foreground text-sm">{t('sharing.loadError')}</p>
        ) : !shares || shares.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('sharing.empty')}</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {shares.map((share) => (
              <div key={share.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {share.userName ?? share.userEmail ?? share.userId}
                  </p>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  <Badge variant={share.role === 'co_author' ? 'primary' : 'muted'}>
                    {t(`sharing.roles.${share.role}`)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={t('sharing.removeAriaLabel')}
                    onClick={() => setPendingRemove(share)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add collaborator */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium">{t('sharing.addTitle')}</h3>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder={t('sharing.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Select
            value={role}
            onValueChange={(v) => setRole(v as ShareRole)}
            disabled={isPending}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHARE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`sharing.roles.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!email.trim() || isPending}
          loading={isPending}
          onClick={handleAdd}
        >
          <UserPlus className="mr-1.5 h-4 w-4" />
          {t('sharing.add')}
        </Button>
      </div>

      {/* Remove confirmation */}
      <AlertDialog
        open={!!pendingRemove}
        onOpenChange={(open) => !open && setPendingRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sharing.removeConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sharing.removeConfirmDescription', {
                name: pendingRemove?.userName ?? pendingRemove?.userEmail ?? pendingRemove?.userId ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sharing.removeCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>
              {t('sharing.removeConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
